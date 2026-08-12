import { GraphTransport, HttpMethod, type GraphRequestOptions } from './graph-transport';
import { ScopeBundle, UserScopedGraph } from './user-scoped-graph';

describe('UserScopedGraph', () => {
  const sendForJson = jest.fn<Promise<unknown>, [GraphRequestOptions]>();
  const transport = { sendForJson } as unknown as GraphTransport;
  const graph = new UserScopedGraph(transport);

  beforeEach(() => {
    jest.clearAllMocks();
    sendForJson.mockResolvedValue({});
  });

  it('reads a site addressed by hostname and server-relative path', async () => {
    await graph.siteByPath('contoso.sharepoint.com', '/sites/marketing').select('id').get();

    expect(sendForJson).toHaveBeenCalledWith({
      method: HttpMethod.Get,
      path: 'sites/contoso.sharepoint.com:/sites/marketing',
      scopes: ScopeBundle.allConsented,
      query: { $select: 'id' },
    });
  });

  it('reads a site addressed by identifier', async () => {
    await graph.siteById('contoso.sharepoint.com,site-guid,web-guid').select('webUrl').get();

    expect(sendForJson).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sites/contoso.sharepoint.com,site-guid,web-guid' }),
    );
  });

  it('selects a complex type the site declares as selectable', async () => {
    await graph
      .siteByPath('contoso.sharepoint.com', '/sites/marketing')
      .select('id', 'webUrl', 'siteCollection')
      .get();

    expect(sendForJson).toHaveBeenCalledWith(
      expect.objectContaining({ query: { $select: 'id,webUrl,siteCollection' } }),
    );
  });

  it('sends no $select when nothing is selected', async () => {
    await graph.siteByPath('contoso.sharepoint.com', '').get();

    expect(sendForJson).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sites/contoso.sharepoint.com', query: undefined }),
    );
  });
});

/** Compile-time contract; `tsc` is what enforces these, not the assertions. */
describe('site selection typing', () => {
  it('admits declared complex types and rejects navigation properties', async () => {
    const sendForJson = jest.fn().mockResolvedValue({ id: 'site-1' });
    const graph = new UserScopedGraph({ sendForJson } as unknown as GraphTransport);
    const site = graph.siteByPath('contoso.sharepoint.com', '/sites/marketing');

    const selected = await site.select('id', 'siteCollection', 'sharepointIds').get();
    const hostname: unknown = selected.siteCollection?.hostname;

    // @ts-expect-error `drive` is a navigation property and needs $expand.
    site.select('drive');
    // @ts-expect-error `quota` belongs to Drive, not Site.
    site.select('quota');
    // @ts-expect-error `displayName` was not selected, so it is absent from the result.
    const unselected: unknown = selected.displayName;

    expect([hostname, unselected]).toHaveLength(2);
  });
});
