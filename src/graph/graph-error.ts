/**
 * Raised for any non-successful Microsoft Graph response, and for requests this
 * client refuses to send. Deliberately not a NestJS `HttpException`: mapping a
 * Graph failure onto an HTTP status is the caller's decision, not the client's.
 */
export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'GraphError';
  }

  /**
   * Graph returns `{ error: { code, message, innerError: { request-id } } }` on
   * failure, but error bodies are not guaranteed to be JSON (gateways and proxies
   * return HTML), so every field here is treated as optional.
   */
  static async fromResponse(response: Response): Promise<GraphError> {
    let code: string | undefined;
    let message = `Microsoft Graph request failed with status ${response.status}`;
    let requestId = response.headers.get('request-id') ?? undefined;

    try {
      const body: unknown = await response.json();
      const error = GraphError.readErrorBody(body);
      if (error) {
        code = error.code;
        message = error.message ?? message;
        requestId = error.requestId ?? requestId;
      }
    } catch {
      // Non-JSON error body; the status-based message above is what we have.
    }

    return new GraphError(message, response.status, code, requestId);
  }

  private static readErrorBody(
    body: unknown,
  ): { code?: string; message?: string; requestId?: string } | undefined {
    if (typeof body !== 'object' || body === null || !('error' in body)) {
      return undefined;
    }
    const { error } = body;
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }

    const { code, message, innerError } = error as {
      code?: unknown;
      message?: unknown;
      innerError?: unknown;
    };
    const requestId =
      typeof innerError === 'object' && innerError !== null
        ? (innerError as Record<string, unknown>)['request-id']
        : undefined;

    return {
      code: typeof code === 'string' ? code : undefined,
      message: typeof message === 'string' ? message : undefined,
      requestId: typeof requestId === 'string' ? requestId : undefined,
    };
  }
}
