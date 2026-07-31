import { generateKeyPairSync, type JsonWebKey, type KeyObject } from 'node:crypto';

import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { sign } from 'jsonwebtoken';

import type { AuthenticatedRequest } from './authenticated-request';
import { MicrosoftBearerTokenGuard } from './microsoft-bearer-token.guard';
import { Unauthenticated } from './unauthenticated.decorator';
import type { ConfigurationService } from '../configuration/configuration.service';

const TENANT_ID = 'test-tenant-id';
const CLIENT_ID = 'test-client-id';
const KEY_ID = 'test-key-id';
const AUDIENCE = `api://${CLIENT_ID}`;
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;

class TestController {
  handler(this: void): void {}

  @Unauthenticated()
  publicHandler(this: void): void {}
}

function toPem(key: KeyObject): string {
  return key.export({ type: 'pkcs1', format: 'pem' }) as string;
}

function mockJwksResponse(jwk: JsonWebKey): jest.SpiedFunction<typeof fetch> {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ keys: [jwk] }),
  } as Response);
}

function buildContext(
  authorizationHeader?: string,
  handler: (...args: never[]) => unknown = TestController.prototype.handler,
): {
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = {
    headers: { authorization: authorizationHeader },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('MicrosoftBearerTokenGuard', () => {
  let privateKeyPem: string;
  let jwk: JsonWebKey;
  let guard: MicrosoftBearerTokenGuard;

  beforeEach(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKeyPem = toPem(privateKey);
    jwk = {
      ...publicKey.export({ format: 'jwk' }),
      kid: KEY_ID,
      alg: 'RS256',
      use: 'sig',
    };
    mockJwksResponse(jwk);

    const configurationService = {
      settings: { azureAdApiClientId: CLIENT_ID, azureAdTenantId: TENANT_ID },
    } as ConfigurationService;
    guard = new MicrosoftBearerTokenGuard(configurationService, new Reflector());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildToken(claims: Record<string, unknown> = {}, signingKey = privateKeyPem): string {
    return sign(
      {
        oid: 'user-object-id',
        name: 'Test User',
        preferred_username: 'test.user@example.com',
        ...claims,
      },
      signingKey,
      {
        algorithm: 'RS256',
        audience: AUDIENCE,
        issuer: ISSUER,
        expiresIn: '5m',
        keyid: KEY_ID,
      },
    );
  }

  it('allows a route marked @Unauthenticated() without checking for a token', async () => {
    const { context, request } = buildContext(undefined, TestController.prototype.publicHandler);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches the access token and user context for a valid bearer token', async () => {
    const token = buildToken();
    const { context, request } = buildContext(`Bearer ${token}`);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: 'user-object-id',
      displayName: 'Test User',
      userPrincipalName: 'test.user@example.com',
      accessToken: token,
    });
  });

  it('rejects a request with no Authorization header', async () => {
    const { context } = buildContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a request with a non-Bearer scheme', async () => {
    const { context } = buildContext('Basic abc123');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different key', async () => {
    const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = buildToken({}, toPem(otherPrivateKey));
    const { context } = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = sign({ oid: 'user-object-id' }, privateKeyPem, {
      algorithm: 'RS256',
      audience: 'api://someone-else',
      issuer: ISSUER,
      expiresIn: '5m',
      keyid: KEY_ID,
    });
    const { context } = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token missing the subject (oid) claim', async () => {
    const token = sign({ name: 'Test User' }, privateKeyPem, {
      algorithm: 'RS256',
      audience: AUDIENCE,
      issuer: ISSUER,
      expiresIn: '5m',
      keyid: KEY_ID,
    });
    const { context } = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
