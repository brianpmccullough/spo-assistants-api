import { GraphError } from './graph-error';
import { Milliseconds } from '../common/milliseconds';

export const GRAPH_HOST = 'graph.microsoft.com';
export const GRAPH_BASE_URL = `https://${GRAPH_HOST}/v1.0`;

const RETRYABLE_STATUSES = new Set([429, 503, 504]);
const MAX_ATTEMPTS = 3;
const INITIAL_BACKOFF = Milliseconds.fromSeconds(0.5);
const MAX_BACKOFF = Milliseconds.fromSeconds(20);

export enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
  Patch = 'PATCH',
  Put = 'PUT',
  Delete = 'DELETE',
}

/** Resolves an access token for the given scopes. Supplied by the auth layer. */
export type AccessTokenProvider = (scopes: readonly string[]) => Promise<string>;

export interface GraphRequestOptions {
  method: HttpMethod;
  path: string;
  scopes: readonly string[];
  query?: Readonly<Record<string, string>>;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}

/**
 * Sends requests to Microsoft Graph: token acquisition, retry on throttling,
 * and error mapping. Knows nothing about resource types.
 */
export class GraphTransport {
  constructor(
    private readonly acquireAccessToken: AccessTokenProvider,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async send(options: GraphRequestOptions): Promise<Response> {
    const url = GraphTransport.resolveUrl(options.path, options.query);
    const accessToken = await this.acquireAccessToken(options.scopes);

    // Caller headers are merged first so client-owned headers win. Letting a call
    // site override `Authorization` would be a way to send an on-behalf-of token
    // somewhere it does not belong.
    const headers: Record<string, string> = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return this.sendWithRetry(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  async sendForJson(options: GraphRequestOptions): Promise<unknown> {
    const response = await this.send(options);

    if (!response.ok) {
      throw await GraphError.fromResponse(response);
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined;
    }
    return response.json();
  }

  /**
   * Relative paths are resolved against the Graph base URL. Absolute URLs are
   * permitted only for Graph itself — a `@odata.nextLink` is the intended case.
   * The host is compared after parsing rather than by prefix match, because
   * `https://graph.microsoft.com@example.invalid/` passes a `startsWith` check and
   * would send the bearer token to `example.invalid`.
   */
  static resolveUrl(pathOrUrl: string, query?: Readonly<Record<string, string>>): URL {
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(`${GRAPH_BASE_URL}/${pathOrUrl.replace(/^\/+/, '')}`);

    if (url.host !== GRAPH_HOST) {
      throw new GraphError(
        `Refusing to send a Microsoft Graph request to host "${url.host}"`,
        0,
        'InvalidHost',
      );
    }
    if (url.username !== '' || url.password !== '') {
      throw new GraphError(
        'Refusing to send a Microsoft Graph request to a URL containing credentials',
        0,
        'InvalidHost',
      );
    }

    const parameters = Object.entries(query ?? {});
    if (parameters.length === 0) {
      // Not re-serialised. An `@odata.nextLink` carries an opaque skiptoken, and
      // rewriting the query string risks altering it. (`URL` still normalises
      // percent-encoding, which is value-preserving.)
      return url;
    }

    // Built by hand rather than via `URLSearchParams`, which form-encodes: it
    // would emit `+` for spaces and `%24` for the `$` in OData parameters. Both
    // are legal, both are harder to read in logs and traces.
    const merged = new Map<string, string>();
    url.searchParams.forEach((value, name) => merged.set(name, value));
    for (const [name, value] of parameters) {
      merged.set(name, value);
    }
    url.search = [...merged]
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('&');

    return url;
  }

  private async sendWithRetry(url: URL, init: RequestInit): Promise<Response> {
    let backoff = INITIAL_BACKOFF;
    let response = await this.fetchImplementation(url, init);
    let attempt = 1;

    while (attempt < MAX_ATTEMPTS && RETRYABLE_STATUSES.has(response.status)) {
      await GraphTransport.wait(GraphTransport.retryDelay(response, backoff));
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
      attempt += 1;
      response = await this.fetchImplementation(url, init);
    }

    return response;
  }

  /** `Retry-After` is in seconds and is authoritative when Graph sends it. */
  private static retryDelay(response: Response, fallback: number): number {
    const retryAfterSeconds = Number(response.headers.get('retry-after'));
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(Milliseconds.fromSeconds(retryAfterSeconds), MAX_BACKOFF);
    }
    return fallback;
  }

  private static wait(duration: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }
}
