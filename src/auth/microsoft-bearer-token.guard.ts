import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { decode, verify, type JwtPayload } from 'jsonwebtoken';

import type { AuthenticatedRequest } from './authenticated-request';
import type { AuthenticatedUser } from './authenticated-user';
import { JwksKeyResolver } from './jwks-key-resolver';
import { IS_UNAUTHENTICATED_KEY } from './unauthenticated.decorator';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class MicrosoftBearerTokenGuard implements CanActivate {
  private readonly jwksKeyResolver: JwksKeyResolver;
  private readonly audience: string;
  private readonly issuer: string;

  constructor(
    configurationService: ConfigurationService,
    private readonly reflector: Reflector,
  ) {
    const { azureAdApiClientId, azureAdTenantId } = configurationService.settings;
    this.audience = `api://${azureAdApiClientId}`;
    this.issuer = `https://login.microsoftonline.com/${azureAdTenantId}/v2.0`;
    this.jwksKeyResolver = new JwksKeyResolver(
      `https://login.microsoftonline.com/${azureAdTenantId}/discovery/v2.0/keys`,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isUnauthenticated = this.reflector.getAllAndOverride<boolean>(IS_UNAUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isUnauthenticated) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = MicrosoftBearerTokenGuard.extractBearerToken(request.headers.authorization);
    const payload = await this.verifyToken(token);

    request.user = MicrosoftBearerTokenGuard.toAuthenticatedUser(payload, token);
    return true;
  }

  private static extractBearerToken(header: string | undefined): string {
    const [scheme, token] = (header ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    const decoded = decode(token, { complete: true });
    const keyId = decoded?.header.kid;
    if (!keyId) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    try {
      const signingKey = await this.jwksKeyResolver.getSigningKey(keyId);
      const payload = verify(token, signingKey, {
        audience: this.audience,
        issuer: this.issuer,
        algorithms: ['RS256'],
      });
      if (typeof payload === 'string') {
        throw new UnauthorizedException('Invalid bearer token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }

  private static toAuthenticatedUser(payload: JwtPayload, accessToken: string): AuthenticatedUser {
    const id: unknown = payload.oid;
    if (typeof id !== 'string') {
      throw new UnauthorizedException('Bearer token missing subject claim');
    }
    return {
      id,
      displayName: typeof payload.name === 'string' ? payload.name : undefined,
      userPrincipalName:
        typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
      accessToken,
    };
  }
}
