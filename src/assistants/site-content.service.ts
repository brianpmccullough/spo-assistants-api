import { Injectable } from '@nestjs/common';

import { GraphClientFactory } from '../graph/graph-client-factory';
import { GraphTokenService } from '../graph/graph-token.service';
import { KqlBuilder, Operator } from '../graph/KqlBuilder';
import { PopularContentViewPeriod, SiteContentItem } from './models/site-content-item';
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
    private readonly graphTokenService: GraphTokenService,
    private readonly graphClientFactory: GraphClientFactory,
  ) {}

  async getRecentContent(userAccessToken: string, siteUrl: string): Promise<SiteContentItem[]> {
    return this.searchContent(userAccessToken, siteUrl, {
      sortField: 'lastModifiedTimeForRetention',
      isDescending: true,
    });
  }

  async getPopularContent(
    userAccessToken: string,
    siteUrl: string,
    viewPeriod: PopularContentViewPeriod = DEFAULT_POPULAR_CONTENT_VIEW_PERIOD,
  ): Promise<SiteContentItem[]> {
    return this.searchContent(userAccessToken, siteUrl, {
      sortField: viewPeriod,
      isDescending: true,
      viewPeriod,
    });
  }

  async getStaleContent(userAccessToken: string, siteUrl: string): Promise<SiteContentItem[]> {
    const staleBefore = new Date();
    staleBefore.setUTCFullYear(staleBefore.getUTCFullYear() - STALE_CONTENT_AGE_YEARS);

    return this.searchContent(userAccessToken, siteUrl, {
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

  private async searchContent(
    userAccessToken: string,
    siteUrl: string,
    options: SiteContentSearchOptions,
  ): Promise<SiteContentItem[]> {
    const graphAccessToken = await this.graphTokenService.exchangeForGraphToken(userAccessToken);
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
