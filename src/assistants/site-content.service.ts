import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GraphClientFactory } from '../graph/graph-client-factory';
import { GraphScopes } from '../graph/graph-scopes';
import { KqlBuilder, Operator } from '../graph/KqlBuilder';
import type { SharePointListItemAllFields } from './models/sharepoint-list-item-all-fields';
import { PopularContentViewPeriod, SiteContentItem } from './models/site-content-item';
import type { SitePageContent } from './models/site-page-content';
import type { AuthenticatedUser } from '../auth/models/authenticated-user';
import { OboTokenService } from '../auth/obo-token.service';
import { ContentClass } from '../graph/models/content-class';
import { SearchEntityType } from '../graph/models/search-entity-type';
import {
  DriveItemSearchResource,
  ListItemSearchResource,
  MicrosoftSearchHit,
  MicrosoftSearchQueryResponse,
} from '../graph/models/SearchResults';
import type { RetrievableField } from '../graph/SearchSchema';

export const DEFAULT_SITE_CONTENT_LIMIT = 10;
export const DEFAULT_POPULAR_CONTENT_VIEW_PERIOD = PopularContentViewPeriod.Recent;
export const STALE_CONTENT_AGE_YEARS = 2;

const SITE_CONTENT_FIELDS = [
  'title',
  'defaultEncodingURL',
  'lastModifiedTimeForRetention',
] as const satisfies readonly RetrievableField[];

type SiteContentField = (typeof SITE_CONTENT_FIELDS)[number] | PopularContentViewPeriod;

type SiteContentSearchResource =
  ListItemSearchResource<SiteContentField> | DriveItemSearchResource<SiteContentField>;

interface SiteContentSearchOptions {
  readonly sortField: 'lastModifiedTimeForRetention' | PopularContentViewPeriod;
  readonly isDescending: boolean;
  readonly viewPeriod?: PopularContentViewPeriod;
  readonly configureQuery?: (query: KqlBuilder) => KqlBuilder;
}

/**
 * Reads documents and site pages through Microsoft Search. It normalizes the
 * different listItem and driveItem response shapes for callers.
 */
@Injectable()
export class SiteContentService {
  constructor(
    private readonly oboTokenService: OboTokenService,
    private readonly graphClientFactory: GraphClientFactory,
  ) {}

  async getRecentContent(user: AuthenticatedUser, siteUrl: string): Promise<SiteContentItem[]> {
    return this.searchContent(user, siteUrl, {
      sortField: 'lastModifiedTimeForRetention',
      isDescending: true,
    });
  }

  async getPopularContent(
    user: AuthenticatedUser,
    siteUrl: string,
    viewPeriod: PopularContentViewPeriod = DEFAULT_POPULAR_CONTENT_VIEW_PERIOD,
  ): Promise<SiteContentItem[]> {
    return this.searchContent(user, siteUrl, {
      sortField: viewPeriod,
      isDescending: true,
      viewPeriod,
    });
  }

  async getStaleContent(user: AuthenticatedUser, siteUrl: string): Promise<SiteContentItem[]> {
    const staleBefore = new Date();
    staleBefore.setUTCFullYear(staleBefore.getUTCFullYear() - STALE_CONTENT_AGE_YEARS);

    return this.searchContent(user, siteUrl, {
      sortField: 'lastModifiedTimeForRetention',
      isDescending: false,
      viewPeriod: PopularContentViewPeriod.Lifetime,
      configureQuery: (query) =>
        query
          .where(
            'lastModifiedTimeForRetention',
            Operator.LessThanOrEqual,
            staleBefore.toISOString(),
          )
          .group((subBuilder) =>
            subBuilder.where('viewsLifetime', Operator.Equals, 0).or().isEmpty('viewsLifetime'),
          ),
    });
  }

  async getPageContent(
    user: AuthenticatedUser,
    siteUrl: string,
    pageUrl: string,
  ): Promise<SitePageContent> {
    const { site, page } = this.parseCurrentPageUrl(siteUrl, pageUrl);
    const sharePointAccessToken = await this.oboTokenService.exchange(
      user.accessToken,
      `${site.origin}/.default`,
    );
    const response = await fetch(this.buildListItemAllFieldsUrl(site, page), {
      headers: {
        Accept: 'application/json;odata=nometadata',
        Authorization: `Bearer ${sharePointAccessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to retrieve the current page content from SharePoint');
    }

    const { CanvasContent1: canvasContent1 } =
      (await response.json()) as SharePointListItemAllFields;
    if (canvasContent1 === undefined) {
      throw new NotFoundException('The current page does not have canvas content');
    }

    return { canvasContent1 };
  }

  private async searchContent(
    user: AuthenticatedUser,
    siteUrl: string,
    options: SiteContentSearchOptions,
  ): Promise<SiteContentItem[]> {
    const graphAccessToken = await this.oboTokenService.exchange(
      user.accessToken,
      GraphScopes.Default,
    );
    const graphClient = this.graphClientFactory.create(graphAccessToken);
    const response = (await graphClient.api('/search/query').post({
      requests: [
        {
          entityTypes: [SearchEntityType.DriveItem, SearchEntityType.ListItem],
          from: 0,
          size: DEFAULT_SITE_CONTENT_LIMIT,
          query: { queryString: this.buildSiteContentQuery(siteUrl, options.configureQuery) },
          fields:
            options.viewPeriod === undefined
              ? SITE_CONTENT_FIELDS
              : [...SITE_CONTENT_FIELDS, options.viewPeriod],
          sortProperties: [{ name: options.sortField, isDescending: options.isDescending }],
        },
      ],
    })) as MicrosoftSearchQueryResponse<SiteContentSearchResource>;

    const viewPeriod = options.viewPeriod;
    return (response.value ?? [])
      .flatMap((searchResponse) => searchResponse.hitsContainers ?? [])
      .flatMap((container) => container.hits ?? [])
      .flatMap((hit) => this.toSiteContentItem(hit, viewPeriod));
  }

  private buildSiteContentQuery(
    siteUrl: string,
    configureQuery?: (query: KqlBuilder) => KqlBuilder,
  ): string {
    const siteRoot = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const query = new KqlBuilder()
      .where('path', Operator.Contains, `${siteRoot}/*`)
      .group((subBuilder) =>
        subBuilder
          .where('contentClass', Operator.Contains, ContentClass.DocumentLibrary)
          .or()
          .where('contentClass', Operator.Contains, ContentClass.WebPageLibrary),
      );
    return (configureQuery?.(query) ?? query).build();
  }

  private parseCurrentPageUrl(siteUrl: string, pageUrl: string): { site: URL; page: URL } {
    let site: URL;
    let page: URL;
    try {
      site = new URL(siteUrl);
      page = new URL(pageUrl);
    } catch {
      throw new BadRequestException('The current page URL must be a valid URL');
    }

    const normalizedSitePath = site.pathname.endsWith('/')
      ? site.pathname.slice(0, -1)
      : site.pathname;
    if (
      site.origin !== page.origin ||
      (normalizedSitePath !== '' && !page.pathname.startsWith(`${normalizedSitePath}/`))
    ) {
      throw new BadRequestException('The current page must belong to the current SharePoint site');
    }

    return { site, page };
  }

  private buildListItemAllFieldsUrl(site: URL, page: URL): string {
    const sitePath = site.pathname.endsWith('/') ? site.pathname.slice(0, -1) : site.pathname;
    const serverRelativePagePath = decodeURIComponent(page.pathname).replaceAll("'", "''");
    const requestUrl = new URL(
      `${site.origin}${sitePath}/_api/web/GetFileByServerRelativeUrl('${serverRelativePagePath}')/ListItemAllFields`,
    );
    requestUrl.searchParams.set('$select', 'CanvasContent1');
    return requestUrl.toString();
  }

  private toSiteContentItem(
    hit: MicrosoftSearchHit<SiteContentSearchResource>,
    viewPeriod?: PopularContentViewPeriod,
  ): SiteContentItem[] {
    const resource = hit.resource;
    if (!resource) {
      return [];
    }

    const fields =
      resource['@odata.type'] === '#microsoft.graph.driveItem'
        ? resource.listItem?.fields
        : resource.fields;
    const { title, defaultEncodingURL } = fields ?? {};
    if (!title || !defaultEncodingURL) {
      return [];
    }

    const viewCount = viewPeriod === undefined ? undefined : fields?.[viewPeriod];
    return [
      {
        name: title,
        webUrl: defaultEncodingURL,
        lastModifiedTimeForRetention: fields?.lastModifiedTimeForRetention,
        ...(viewCount === undefined ? {} : { viewCount }),
      },
    ];
  }
}
