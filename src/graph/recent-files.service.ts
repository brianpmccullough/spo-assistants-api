import { Injectable } from '@nestjs/common';

import { GraphClientFactory } from './graph-client-factory';
import { GraphTokenService } from './graph-token.service';
import { MicrosoftSearchHit, MicrosoftSearchQueryResponse } from './microsoft-search.types';

export const DEFAULT_RECENT_FILES_LIMIT = 5;

export interface RecentFile {
  readonly name: string;
  readonly webUrl: string;
  readonly lastModifiedDateTime?: string;
}

interface DriveItemSearchResource {
  readonly name?: string;
  readonly webUrl?: string;
  readonly lastModifiedDateTime?: string;
}

/**
 * Reads SharePoint files through Microsoft Search. Token exchange and Graph client
 * construction stay here, outside the LLM-facing tool descriptor.
 */
@Injectable()
export class RecentFilesService {
  constructor(
    private readonly graphTokenService: GraphTokenService,
    private readonly graphClientFactory: GraphClientFactory,
  ) {}

  async listRecentFiles(userAccessToken: string, siteUrl: string): Promise<RecentFile[]> {
    const graphAccessToken = await this.graphTokenService.exchangeForGraphToken(userAccessToken);
    const graphClient = this.graphClientFactory.create(graphAccessToken);
    const response = (await graphClient.api('/search/query').post({
      requests: [
        {
          entityTypes: ['driveItem'],
          from: 0,
          size: DEFAULT_RECENT_FILES_LIMIT,
          query: {
            queryString: `path:${JSON.stringify(this.toSitePath(siteUrl))} AND isDocument:1`,
          },
          fields: ['name', 'webUrl', 'lastModifiedDateTime'],
          sortProperties: [{ name: 'lastModifiedDateTime', isDescending: true }],
        },
      ],
    })) as MicrosoftSearchQueryResponse<DriveItemSearchResource>;

    return (response.value ?? [])
      .flatMap((searchResponse) => searchResponse.hitsContainers ?? [])
      .flatMap((container) => container.hits ?? [])
      .flatMap((hit) => this.toRecentFile(hit));
  }

  private toSitePath(siteUrl: string): string {
    const siteRoot = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    return `${siteRoot}/*`;
  }

  private toRecentFile(hit: MicrosoftSearchHit<DriveItemSearchResource>): RecentFile[] {
    const { name, webUrl, lastModifiedDateTime } = hit.resource ?? {};
    return name && webUrl ? [{ name, webUrl, lastModifiedDateTime }] : [];
  }
}
