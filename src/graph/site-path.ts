import { GraphError } from './graph-error';

/**
 * A SharePoint site's address within Microsoft Graph.
 *
 * Sites can be addressed two ways, and they build child paths differently, which
 * is the reason this is a value object rather than a string:
 *
 * - by identifier — `sites/{site-id}`, children appended with `/`
 * - by path       — `sites/{hostname}:/{server-relative-path}`, where the colons
 *   delimit the path portion and a *closing* colon is required before any child:
 *   `sites/contoso.sharepoint.com:/sites/marketing:/lists`
 */
export interface SitePath {
  /** Path addressing the site itself. */
  readonly self: string;
  /** Path addressing a resource beneath the site, e.g. `lists`. */
  child(segment: string): string;
}

/**
 * Addresses a site by its Graph identifier — either the composite
 * `{hostname},{siteCollectionId},{webId}` form or a bare GUID.
 */
export function siteById(siteId: string): SitePath {
  const identifier = requireSafeSegment(siteId, 'site id');
  return {
    self: `sites/${identifier}`,
    child: (segment) => `sites/${identifier}/${requireSafeSegment(segment, 'child segment')}`,
  };
}

/**
 * Addresses a site by hostname and server-relative URL, e.g.
 * `('contoso.sharepoint.com', '/sites/marketing')`.
 *
 * An empty or root-only relative path addresses the tenant's root site, which
 * has no path portion and therefore no colons.
 */
export function siteByPath(hostname: string, serverRelativePath: string): SitePath {
  const host = requireSafeSegment(hostname, 'hostname');
  const path = encodeServerRelativePath(serverRelativePath);

  if (path === '') {
    return {
      self: `sites/${host}`,
      child: (segment) => `sites/${host}/${requireSafeSegment(segment, 'child segment')}`,
    };
  }

  return {
    self: `sites/${host}:/${path}`,
    // The closing colon is what separates the site's path from the child
    // resource; without it Graph reads the child as another path segment.
    child: (segment) => `sites/${host}:/${path}:/${requireSafeSegment(segment, 'child segment')}`,
  };
}

/**
 * Percent-encodes each segment while leaving the separators alone, so a site at
 * `/sites/Marketing Team` becomes `sites/Marketing%20Team`. Encoding the whole
 * string would escape the slashes; leaving it unencoded breaks on spaces and
 * other reserved characters.
 */
function encodeServerRelativePath(serverRelativePath: string): string {
  return serverRelativePath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Rejects values that would restructure the URL rather than sit inside it. A
 * hostname or identifier containing `/` or `:` could otherwise redirect the
 * request to a different resource than the caller named.
 */
function requireSafeSegment(value: string, description: string): string {
  if (value === '' || /[/:?#]/.test(value)) {
    throw new GraphError(`Invalid ${description}: "${value}"`, 0, 'InvalidPath');
  }
  return value;
}
