import { GraphError } from './graph-error';
import { GRAPH_BASE_URL, GraphTransport, HttpMethod } from './graph-transport';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('GraphTransport', () => {
  const acquireAccessToken = jest.fn<Promise<string>, [readonly string[]]>();

  beforeEach(() => {
    jest.clearAllMocks();
    acquireAccessToken.mockResolvedValue('test-access-token');
  });

  describe('resolveUrl', () => {
    it('resolves a relative path against the Graph base URL', () => {
      expect(GraphTransport.resolveUrl('me').toString()).toBe(`${GRAPH_BASE_URL}/me`);
    });

    it('tolerates a leading slash', () => {
      expect(GraphTransport.resolveUrl('/me').toString()).toBe(`${GRAPH_BASE_URL}/me`);
    });

    it('allows an absolute Graph URL, as used by @odata.nextLink', () => {
      const nextLink = `${GRAPH_BASE_URL}/users?$skiptoken=abc`;
      expect(GraphTransport.resolveUrl(nextLink).toString()).toBe(nextLink);
    });

    it('refuses an absolute URL pointing at another host', () => {
      expect(() => GraphTransport.resolveUrl('https://example.invalid/me')).toThrow(GraphError);
    });

    // The bearer token would otherwise be sent to example.invalid: the Graph host
    // appears only in the userinfo portion, so a prefix check would pass this.
    it('refuses a URL that hides another host behind userinfo', () => {
      expect(() =>
        GraphTransport.resolveUrl('https://graph.microsoft.com@example.invalid/me'),
      ).toThrow(/Refusing to send/);
    });

    it('refuses credentials embedded in an otherwise valid Graph URL', () => {
      expect(() =>
        GraphTransport.resolveUrl('https://user:secret@graph.microsoft.com/v1.0/me'),
      ).toThrow(/credentials/);
    });

    it('encodes query parameters without form-encoding spaces or the OData $', () => {
      const url = GraphTransport.resolveUrl('users', { $filter: "displayName eq 'a b'" });
      expect(url.searchParams.get('$filter')).toBe("displayName eq 'a b'");
      // Spaces are %20 rather than `+`, and the OData `$` is left literal.
      expect(url.search).toBe('?$filter=displayName%20eq%20%27a%20b%27');
    });

    it('preserves a nextLink skiptoken when no query is supplied', () => {
      const nextLink = `${GRAPH_BASE_URL}/users?$skiptoken=X'4453'`;
      expect(GraphTransport.resolveUrl(nextLink).searchParams.get('$skiptoken')).toBe("X'4453'");
    });
  });

  describe('send', () => {
    it('attaches the acquired token for the requested scopes', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(jsonResponse({}));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await transport.send({ method: HttpMethod.Get, path: 'me', scopes: ['Scope.Read'] });

      expect(acquireAccessToken).toHaveBeenCalledWith(['Scope.Read']);
      const [, init] = fetchImplementation.mock.calls[0] as [URL, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-access-token',
      );
    });

    it('does not let a caller override the Authorization header', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(jsonResponse({}));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await transport.send({
        method: HttpMethod.Get,
        path: 'me',
        scopes: [],
        headers: { Authorization: 'Bearer attacker-supplied' },
      });

      const [, init] = fetchImplementation.mock.calls[0] as [URL, RequestInit];
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-access-token',
      );
    });

    it('passes caller headers through', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(jsonResponse({}));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await transport.send({
        method: HttpMethod.Get,
        path: 'users',
        scopes: [],
        headers: { ConsistencyLevel: 'eventual' },
      });

      const [, init] = fetchImplementation.mock.calls[0] as [URL, RequestInit];
      expect((init.headers as Record<string, string>).ConsistencyLevel).toBe('eventual');
    });
  });

  describe('retry', () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick'] }));
    afterEach(() => jest.useRealTimers());

    it('retries a throttled request and honours Retry-After', async () => {
      const fetchImplementation = jest
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '1' } }))
        .mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      const pending = transport.sendForJson({ method: HttpMethod.Get, path: 'me', scopes: [] });
      await jest.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toEqual({ id: 'user-1' });
      expect(fetchImplementation).toHaveBeenCalledTimes(2);
    });

    it('gives up after the attempt limit and reports the failure', async () => {
      const fetchImplementation = jest
        .fn()
        .mockResolvedValue(new Response('', { status: 503, headers: { 'retry-after': '1' } }));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      const pending = transport.sendForJson({ method: HttpMethod.Get, path: 'me', scopes: [] });
      const assertion = expect(pending).rejects.toThrow(GraphError);
      await jest.advanceTimersByTimeAsync(5000);

      await assertion;
      expect(fetchImplementation).toHaveBeenCalledTimes(3);
    });

    it('does not retry a client error', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(new Response('', { status: 404 }));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await expect(
        transport.sendForJson({ method: HttpMethod.Get, path: 'me', scopes: [] }),
      ).rejects.toThrow(GraphError);
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    });
  });

  describe('errors', () => {
    it('surfaces the Graph error code and request id', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'itemNotFound',
              message: 'Item not found',
              innerError: { 'request-id': 'abc-123' },
            },
          },
          { status: 404 },
        ),
      );
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      const error: unknown = await transport
        .sendForJson({ method: HttpMethod.Get, path: 'me', scopes: [] })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GraphError);
      const graphError = error as GraphError;
      expect(graphError.status).toBe(404);
      expect(graphError.code).toBe('itemNotFound');
      expect(graphError.message).toBe('Item not found');
      expect(graphError.requestId).toBe('abc-123');
    });

    it('falls back to a status message when the error body is not JSON', async () => {
      const fetchImplementation = jest
        .fn()
        .mockResolvedValue(new Response('<html>Gateway Timeout</html>', { status: 502 }));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await expect(
        transport.sendForJson({ method: HttpMethod.Get, path: 'me', scopes: [] }),
      ).rejects.toThrow('Microsoft Graph request failed with status 502');
    });

    it('returns undefined for a 204', async () => {
      const fetchImplementation = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const transport = new GraphTransport(acquireAccessToken, fetchImplementation);

      await expect(
        transport.sendForJson({ method: HttpMethod.Delete, path: 'me', scopes: [] }),
      ).resolves.toBeUndefined();
    });
  });
});
