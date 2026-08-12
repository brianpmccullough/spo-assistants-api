import { GraphTransport, HttpMethod } from './graph-transport';

/**
 * Escape hatch for endpoints this client does not model yet. It turns off
 * *typing*, not the client: token acquisition, throttling retry, host validation
 * and `GraphError` mapping all still apply, so reaching for `raw` never means
 * giving up the safety of the surrounding stack.
 *
 * Responses are `unknown` by design — a generic here would be an unchecked
 * assertion. Narrow at the call site.
 *
 * `grep -rn "\.raw(" src/` lists every untyped Graph call in the codebase, which
 * doubles as the backlog of endpoints worth promoting to typed resources.
 */
export class GraphRawRequest {
  constructor(
    private readonly transport: GraphTransport,
    private readonly path: string,
    private readonly scopes: readonly string[],
    private readonly requestHeaders: Readonly<Record<string, string>> = {},
    private readonly queryParameters: Readonly<Record<string, string>> = {},
  ) {}

  /**
   * Adds request headers. `Authorization` cannot be overridden — the transport
   * applies its own last.
   */
  headers(headers: Readonly<Record<string, string>>): GraphRawRequest {
    return new GraphRawRequest(
      this.transport,
      this.path,
      this.scopes,
      { ...this.requestHeaders, ...headers },
      this.queryParameters,
    );
  }

  /** Adds query parameters, encoded for you — `{ $filter: "displayName eq 'a b'" }`. */
  query(parameters: Readonly<Record<string, string>>): GraphRawRequest {
    return new GraphRawRequest(this.transport, this.path, this.scopes, this.requestHeaders, {
      ...this.queryParameters,
      ...parameters,
    });
  }

  get(): Promise<unknown> {
    return this.sendForJson(HttpMethod.Get);
  }

  post(body?: unknown): Promise<unknown> {
    return this.sendForJson(HttpMethod.Post, body);
  }

  patch(body?: unknown): Promise<unknown> {
    return this.sendForJson(HttpMethod.Patch, body);
  }

  put(body?: unknown): Promise<unknown> {
    return this.sendForJson(HttpMethod.Put, body);
  }

  async delete(): Promise<void> {
    await this.sendForJson(HttpMethod.Delete);
  }

  /**
   * The unparsed `Response`, for binary content, streaming, or unusual status
   * handling. Non-successful statuses are *not* thrown here — the caller owns
   * the response entirely.
   */
  response(method: HttpMethod = HttpMethod.Get, body?: unknown): Promise<Response> {
    return this.transport.send({
      method,
      path: this.path,
      scopes: this.scopes,
      headers: this.requestHeaders,
      query: this.queryParameters,
      body,
    });
  }

  private sendForJson(method: HttpMethod, body?: unknown): Promise<unknown> {
    return this.transport.sendForJson({
      method,
      path: this.path,
      scopes: this.scopes,
      headers: this.requestHeaders,
      query: this.queryParameters,
      body,
    });
  }
}
