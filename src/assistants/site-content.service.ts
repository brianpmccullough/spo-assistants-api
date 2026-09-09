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

const SITE_CONTENT_FIELDS = [
  'title',
  'defaultEncodingURL',
  'lastModifiedTimeForRetention',
] as const satisfies readonly RetrievableField[];

type SiteContentField = (typeof SITE_CONTENT_FIELDS)[number] | PopularContentViewPeriod;

type SiteContentSearchResource =
  ListItemSearchResource<SiteContentField> | DriveItemSearchResource<SiteContentField>;

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
    return this.searchContent(userAccessToken, siteUrl, 'lastModifiedTimeForRetention');
  }

  async getPopularContent(
    userAccessToken: string,
    siteUrl: string,
    viewPeriod: PopularContentViewPeriod = DEFAULT_POPULAR_CONTENT_VIEW_PERIOD,
  ): Promise<SiteContentItem[]> {
    return this.searchContent(userAccessToken, siteUrl, viewPeriod);
  }

  private async searchContent(
    userAccessToken: string,
    siteUrl: string,
    sortField: 'lastModifiedTimeForRetention' | PopularContentViewPeriod,
  ): Promise<SiteContentItem[]> {
    const graphAccessToken = await this.graphTokenService.exchangeForGraphToken(userAccessToken);
    const graphClient = this.graphClientFactory.create(graphAccessToken);
    const response = (await graphClient.api('/search/query').post({
      requests: [
        {
          entityTypes: [SearchEntityType.DriveItem, SearchEntityType.ListItem],
          from: 0,
          size: DEFAULT_SITE_CONTENT_LIMIT,
          query: { queryString: this.buildSiteContentQuery(siteUrl) },
          fields:
            sortField === 'lastModifiedTimeForRetention'
              ? SITE_CONTENT_FIELDS
              : [...SITE_CONTENT_FIELDS, sortField],
          sortProperties: [{ name: sortField, isDescending: true }],
        },
      ],
    })) as MicrosoftSearchQueryResponse<SiteContentSearchResource>;

    const viewPeriod = this.isPopularContentViewPeriod(sortField) ? sortField : undefined;
    return (response.value ?? [])
      .flatMap((searchResponse) => searchResponse.hitsContainers ?? [])
      .flatMap((container) => container.hits ?? [])
      .flatMap((hit) => this.toSiteContentItem(hit, viewPeriod));
  }

  private isPopularContentViewPeriod(
    sortField: 'lastModifiedTimeForRetention' | PopularContentViewPeriod,
  ): sortField is PopularContentViewPeriod {
    return Object.values(PopularContentViewPeriod).includes(sortField as PopularContentViewPeriod);
  }

  private buildSiteContentQuery(siteUrl: string): string {
    const siteRoot = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    return new KqlBuilder()
      .where('path', Operator.Contains, `${siteRoot}/*`)
      .group((subBuilder) =>
        subBuilder
          .where('contentClass', Operator.Contains, ContentClass.DocumentLibrary)
          .or()
          .where('contentClass', Operator.Contains, ContentClass.WebPageLibrary),
      )
      .build();
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
