import { GraphError } from './graph-error';
import { siteById, siteByPath } from './site-path';

describe('siteByPath', () => {
  it('separates hostname from path with a colon, leaving the colon unencoded', () => {
    expect(siteByPath('contoso.sharepoint.com', '/sites/marketing').self).toBe(
      'sites/contoso.sharepoint.com:/sites/marketing',
    );
  });

  it('accepts a relative path with or without a leading slash', () => {
    expect(siteByPath('contoso.sharepoint.com', 'sites/marketing').self).toBe(
      'sites/contoso.sharepoint.com:/sites/marketing',
    );
  });

  // Encoding the path as a whole would escape the separators; leaving it
  // unencoded breaks on spaces. Each segment is encoded individually.
  it('encodes each path segment but preserves the separators', () => {
    expect(siteByPath('contoso.sharepoint.com', '/sites/Marketing Team/R&D').self).toBe(
      'sites/contoso.sharepoint.com:/sites/Marketing%20Team/R%26D',
    );
  });

  it('addresses the root site with no path portion when the relative path is empty', () => {
    expect(siteByPath('contoso.sharepoint.com', '').self).toBe('sites/contoso.sharepoint.com');
    expect(siteByPath('contoso.sharepoint.com', '/').self).toBe('sites/contoso.sharepoint.com');
  });

  // Without the closing colon, Graph reads `lists` as another path segment of
  // the site URL rather than as the child resource.
  it('closes the path with a colon before a child resource', () => {
    expect(siteByPath('contoso.sharepoint.com', '/sites/marketing').child('lists')).toBe(
      'sites/contoso.sharepoint.com:/sites/marketing:/lists',
    );
  });

  it('omits the colons for a root site child', () => {
    expect(siteByPath('contoso.sharepoint.com', '').child('lists')).toBe(
      'sites/contoso.sharepoint.com/lists',
    );
  });

  it('rejects a hostname that would restructure the request path', () => {
    expect(() => siteByPath('contoso.sharepoint.com/sites/other', '/sites/x')).toThrow(GraphError);
    expect(() => siteByPath('contoso.sharepoint.com:8080', '/sites/x')).toThrow(/Invalid hostname/);
    expect(() => siteByPath('', '/sites/x')).toThrow(/Invalid hostname/);
  });
});

describe('siteById', () => {
  it('addresses a site by its composite identifier', () => {
    const siteId = 'contoso.sharepoint.com,7a6f0f0a-0000-0000-0000-000000000000,9b1c2d3e';
    expect(siteById(siteId).self).toBe(`sites/${siteId}`);
  });

  it('appends children directly, with no colon delimiters', () => {
    expect(siteById('site-id').child('lists')).toBe('sites/site-id/lists');
  });

  it('rejects an identifier containing path or query characters', () => {
    expect(() => siteById('site-id/lists')).toThrow(/Invalid site id/);
    expect(() => siteById('site-id?$select=id')).toThrow(/Invalid site id/);
    expect(() => siteById('')).toThrow(/Invalid site id/);
  });
});
