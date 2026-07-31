import { createPublicKey, type KeyObject } from 'node:crypto';

import { Milliseconds } from '../common/milliseconds';

const CACHE_MAX_AGE_MILLISECONDS = Milliseconds.fromMinutes(10);

interface JsonWebKey {
  kid: string;
  [property: string]: unknown;
}

interface JwksResponse {
  keys: JsonWebKey[];
}

// Resolves signing keys from an EntraID JWKS endpoint, with a short-lived
// cache so key rotation is picked up without hammering the endpoint on
// every request.
export class JwksKeyResolver {
  private cachedKeysByKeyId: Map<string, KeyObject> | undefined;
  private cachedAt = 0;

  constructor(private readonly jwksUri: string) {}

  async getSigningKey(keyId: string): Promise<KeyObject> {
    const keysByKeyId = await this.getKeysByKeyId();
    const key = keysByKeyId.get(keyId);
    if (key) {
      return key;
    }

    // Key not found in cache — could be a recent rotation. Refresh once
    // before giving up.
    const refreshedKeysByKeyId = await this.getKeysByKeyId({ forceRefresh: true });
    const refreshedKey = refreshedKeysByKeyId.get(keyId);
    if (!refreshedKey) {
      throw new Error(`No signing key found for kid "${keyId}"`);
    }
    return refreshedKey;
  }

  private async getKeysByKeyId(options?: {
    forceRefresh: boolean;
  }): Promise<Map<string, KeyObject>> {
    const isStale = Date.now() - this.cachedAt > CACHE_MAX_AGE_MILLISECONDS;
    if (!this.cachedKeysByKeyId || isStale || options?.forceRefresh) {
      this.cachedKeysByKeyId = await this.fetchKeysByKeyId();
      this.cachedAt = Date.now();
    }
    return this.cachedKeysByKeyId;
  }

  private async fetchKeysByKeyId(): Promise<Map<string, KeyObject>> {
    const response = await fetch(this.jwksUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS from ${this.jwksUri}: ${response.status}`);
    }

    const { keys } = (await response.json()) as JwksResponse;
    return new Map(keys.map((key) => [key.kid, createPublicKey({ key, format: 'jwk' })]));
  }
}
