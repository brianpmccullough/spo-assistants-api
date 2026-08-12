import type { Site, User } from '@microsoft/microsoft-graph-types';

import { GraphItem, type SelectableKey } from './graph-resource';
import { GraphTransport, HttpMethod, type GraphRequestOptions } from './graph-transport';

describe('GraphItem', () => {
  const sendForJson = jest.fn<Promise<unknown>, [GraphRequestOptions]>();
  const transport = { sendForJson } as unknown as GraphTransport;

  beforeEach(() => {
    jest.clearAllMocks();
    sendForJson.mockResolvedValue({});
  });

  it('requests the resource with no $select when nothing is selected', async () => {
    await new GraphItem<User>(transport, 'me', ['Scope.Read']).get();

    expect(sendForJson).toHaveBeenCalledWith({
      method: HttpMethod.Get,
      path: 'me',
      scopes: ['Scope.Read'],
      query: undefined,
    });
  });

  it('sends the selected fields as a single comma-separated $select', async () => {
    await new GraphItem<User>(transport, 'me', []).select('id', 'displayName').get();

    expect(sendForJson).toHaveBeenCalledWith(
      expect.objectContaining({ query: { $select: 'id,displayName' } }),
    );
  });

  // `select` maps onto one query parameter, so a second call replaces the first
  // rather than accumulating. The types say the same thing.
  it('replaces an earlier selection rather than merging', async () => {
    await new GraphItem<User>(transport, 'me', []).select('id').select('displayName').get();

    expect(sendForJson).toHaveBeenCalledWith(
      expect.objectContaining({ query: { $select: 'displayName' } }),
    );
  });

  it('returns the parsed response', async () => {
    sendForJson.mockResolvedValue({ id: 'user-1', displayName: 'Ada' });

    const user = await new GraphItem<User>(transport, 'me', []).select('id', 'displayName').get();

    expect(user).toEqual({ id: 'user-1', displayName: 'Ada' });
  });
});

/**
 * Compile-time contract. These assertions fail the build, not the test run —
 * `tsc` is what verifies them, so the runtime body only has to exist.
 */
describe('SelectableKey', () => {
  it('admits scalars, rejects navigation properties, and admits declared complex types', () => {
    const scalar: SelectableKey<Site> = 'webUrl';
    const identifier: SelectableKey<Site> = 'id';
    const complex: SelectableKey<Site, 'siteCollection'> = 'siteCollection';

    // @ts-expect-error `drive` is a navigation property: it needs $expand, not $select.
    const navigation: SelectableKey<Site> = 'drive';

    // @ts-expect-error `siteCollection` is only selectable where the resource declares it.
    const undeclaredComplex: SelectableKey<Site> = 'siteCollection';

    // @ts-expect-error `quota` belongs to Drive, not Site.
    const foreign: SelectableKey<Site> = 'quota';

    expect([scalar, identifier, complex, navigation, undeclaredComplex, foreign]).toHaveLength(6);
  });

  it('narrows the resolved shape to the selected fields', async () => {
    const sendForJson = jest.fn().mockResolvedValue({ id: 'site-1' });
    const transport = { sendForJson } as unknown as GraphTransport;

    const site = await new GraphItem<Site>(transport, 'sites/root', [])
      .select('id', 'webUrl')
      .get();

    const selected: string | undefined = site.id;
    // @ts-expect-error `displayName` was not selected, so it is not on the result.
    const unselected: unknown = site.displayName;

    expect([selected, unselected]).toHaveLength(2);
  });
});
