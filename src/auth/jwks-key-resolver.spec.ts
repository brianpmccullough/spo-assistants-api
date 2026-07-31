import { generateKeyPairSync, type JsonWebKey } from 'node:crypto';

import { JwksKeyResolver } from './jwks-key-resolver';

const JWKS_URI = 'https://login.microsoftonline.com/test-tenant-id/discovery/v2.0/keys';

function buildJwk(keyId: string): JsonWebKey {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    ...publicKey.export({ format: 'jwk' }),
    kid: keyId,
    alg: 'RS256',
    use: 'sig',
  };
}

function mockFetchOnce(keys: JsonWebKey[]): jest.SpiedFunction<typeof fetch> {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ keys }),
  } as Response);
}

describe('JwksKeyResolver', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves a known key id from the JWKS endpoint', async () => {
    const jwk = buildJwk('key-1');
    mockFetchOnce([jwk]);
    const resolver = new JwksKeyResolver(JWKS_URI);

    const key = await resolver.getSigningKey('key-1');

    expect(key.asymmetricKeyType).toBe('rsa');
  });

  it('caches the key set instead of fetching on every lookup', async () => {
    const jwk = buildJwk('key-1');
    const fetchMock = mockFetchOnce([jwk]);
    const resolver = new JwksKeyResolver(JWKS_URI);

    await resolver.getSigningKey('key-1');
    await resolver.getSigningKey('key-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once when a key id is not found, to pick up recent rotation', async () => {
    const staleJwk = buildJwk('old-key');
    const rotatedJwk = buildJwk('new-key');
    mockFetchOnce([staleJwk]);
    mockFetchOnce([rotatedJwk]);
    const resolver = new JwksKeyResolver(JWKS_URI);

    const key = await resolver.getSigningKey('new-key');

    expect(key.asymmetricKeyType).toBe('rsa');
  });

  it('throws when a key id is missing even after a refetch', async () => {
    mockFetchOnce([buildJwk('key-1')]);
    mockFetchOnce([buildJwk('key-1')]);
    const resolver = new JwksKeyResolver(JWKS_URI);

    await expect(resolver.getSigningKey('missing-key')).rejects.toThrow(/missing-key/);
  });
});
