import type { Site, User } from '@microsoft/microsoft-graph-types';

import { GraphRawRequest } from './graph-raw-request';
import { GraphItem } from './graph-resource';
import { GraphTransport } from './graph-transport';
import { siteById, siteByPath } from './site-path';

/**
 * Delegated scopes, grouped into bundles rather than declared per resource.
 * Microsoft Entra caches tokens per scope set, so a distinct scope list for every
 * resource would mean a separate on-behalf-of exchange and cache entry for each
 * one. A small number of bundles keeps the cache shallow while still preserving
 * least privilege — unlike `/.default`, which would put every consented
 * permission into every token this API mints.
 */
export const ScopeBundle = {
  /**
   * Every delegated permission the signed-in user has consented to for this app.
   * The default for delegated calls.
   *
   * Safe as a default because delegated access is the intersection of the app's
   * permissions and the user's own: a `/.default` token cannot reach anything the
   * signed-in user could not reach themselves, and SharePoint's permission
   * trimming applies regardless. It also avoids `AADSTS65001` failures from
   * requesting a named scope the registration has not been consented, and keeps
   * one cached token per user instead of one per scope combination.
   *
   * Cannot be combined with named scopes in a single request — Entra rejects
   * mixing static and dynamic consent.
   */
  allConsented: ['https://graph.microsoft.com/.default'] as const,

  /**
   * Narrow bundles, for compartmentalising the app from itself rather than
   * protecting the user. Worth using once the app registration holds any write
   * permission: a token scoped to reading profiles cannot be turned into a
   * mail-send by a compromised or prompt-injected tool loop, even though the
   * signed-in user is allowed to send mail.
   */
  userProfile: ['https://graph.microsoft.com/User.Read'] as const,
};

/**
 * Complex types on `Site` that Microsoft Graph will return via `$select`. They
 * are objects, so the scalar-only rule excludes them by default; naming them here
 * puts them back in reach without also admitting navigation properties like
 * `drive` or `lists`, which need `$expand`.
 */
type SelectableSiteComplexType = 'siteCollection' | 'sharepointIds';

type SiteItem = GraphItem<Site, SelectableSiteComplexType>;

/**
 * Microsoft Graph, bound to one signed-in user. Every call made through it runs
 * on-behalf-of that user, so SharePoint's own permission trimming applies.
 */
export class UserScopedGraph {
  constructor(private readonly transport: GraphTransport) {}

  /** The signed-in user. */
  get me(): GraphItem<User> {
    return new GraphItem<User>(this.transport, 'me', ScopeBundle.allConsented);
  }

  /**
   * A SharePoint site addressed by hostname and server-relative URL, e.g.
   * `siteByPath('contoso.sharepoint.com', '/sites/marketing')`. An empty
   * relative path addresses the tenant's root site.
   */
  siteByPath(hostname: string, serverRelativePath: string): SiteItem {
    return this.site(siteByPath(hostname, serverRelativePath).self);
  }

  /**
   * A SharePoint site addressed by its Graph identifier — the composite
   * `{hostname},{siteCollectionId},{webId}` form or a bare GUID.
   */
  siteById(siteId: string): SiteItem {
    return this.site(siteById(siteId).self);
  }

  private site(path: string): SiteItem {
    return new GraphItem<Site, SelectableSiteComplexType>(
      this.transport,
      path,
      ScopeBundle.allConsented,
    );
  }

  /**
   * Untyped access for endpoints not modelled above. See {@link GraphRawRequest}.
   *
   * Pass a narrower {@link ScopeBundle} to compartmentalise a particular call.
   */
  raw(path: string, scopes: readonly string[] = ScopeBundle.allConsented): GraphRawRequest {
    return new GraphRawRequest(this.transport, path, scopes);
  }
}
