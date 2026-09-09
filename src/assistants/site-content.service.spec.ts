import type { GraphTokenService } from '../graph/graph-token.service';
import { PopularContentViewPeriod } from './models/site-content-item';
import {
  DEFAULT_SITE_CONTENT_LIMIT,
  SiteContentService,
  STALE_CONTENT_AGE_YEARS,
} from './site-content.service';
import { SearchEntityType } from '../graph/models/search-entity-type';

describe('SiteContentService', () => {
  const userAccessToken = 'user-access-token';
  const graphAccessToken = 'graph-access-token';
  const siteUrl = 'https://contoso.sharepoint.com/sites/team';

  let post: jest.Mock;
  let graphTokenService: { exchangeForGraphToken: jest.Mock };
  let graphClientFactory: { create: jest.Mock };
  let service: SiteContentService;

  beforeEach(() => {
    post = jest.fn();
    graphTokenService = { exchangeForGraphToken: jest.fn().mockResolvedValue(graphAccessToken) };
    graphClientFactory = {
      create: jest.fn().mockReturnValue({ api: jest.fn().mockReturnValue({ post }) }),
    };
    service = new SiteContentService(
      graphTokenService as unknown as GraphTokenService,
      graphClientFactory,
    );
  });

  it('returns recent content from driveItem fields', async () => {
    post.mockResolvedValue({
      value: [
        {
          hitsContainers: [
            {
              hits: [
                {
                  resource: {
                    '@odata.type': '#microsoft.graph.driveItem',
                    listItem: {
                      fields: {
                        title: 'Quarterly report.docx',
                        defaultEncodingURL:
                          'https://contoso.sharepoint.com/sites/team/Shared%20Documents/report.docx',
                        lastModifiedTimeForRetention: '2026-09-07T10:00:00Z',
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    await expect(service.getRecentContent(userAccessToken, siteUrl)).resolves.toEqual([
      {
        name: 'Quarterly report.docx',
        webUrl: 'https://contoso.sharepoint.com/sites/team/Shared%20Documents/report.docx',
        lastModifiedTimeForRetention: '2026-09-07T10:00:00Z',
      },
    ]);

    expect(graphTokenService.exchangeForGraphToken).toHaveBeenCalledWith(userAccessToken);
    expect(graphClientFactory.create).toHaveBeenCalledWith(graphAccessToken);
    expect(post).toHaveBeenCalledWith({
      requests: [
        {
          entityTypes: [SearchEntityType.DriveItem, SearchEntityType.ListItem],
          from: 0,
          size: DEFAULT_SITE_CONTENT_LIMIT,
          query: {
            queryString:
              'path:https://contoso.sharepoint.com/sites/team/* AND (contentClass:STS_ListItem_DocumentLibrary OR contentClass:STS_ListItem_WebPageLibrary)',
          },
          fields: ['title', 'defaultEncodingURL', 'lastModifiedTimeForRetention'],
          sortProperties: [{ name: 'lastModifiedTimeForRetention', isDescending: true }],
        },
      ],
    });
  });

  it('returns popular content from listItem fields', async () => {
    post.mockResolvedValue({
      value: [
        {
          hitsContainers: [
            {
              hits: [
                {
                  resource: {
                    '@odata.type': '#microsoft.graph.listItem',
                    fields: {
                      title: 'Frequently used guide',
                      defaultEncodingURL:
                        'https://contoso.sharepoint.com/sites/team/SitePages/Frequently%20used%20guide.aspx',
                      lastModifiedTimeForRetention: '2026-09-07T10:00:00Z',
                      [PopularContentViewPeriod.Recent]: 42,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    await expect(service.getPopularContent(userAccessToken, siteUrl)).resolves.toEqual([
      {
        name: 'Frequently used guide',
        webUrl:
          'https://contoso.sharepoint.com/sites/team/SitePages/Frequently%20used%20guide.aspx',
        lastModifiedTimeForRetention: '2026-09-07T10:00:00Z',
        viewCount: 42,
      },
    ]);

    expect(post).toHaveBeenCalledWith({
      requests: [
        {
          entityTypes: [SearchEntityType.DriveItem, SearchEntityType.ListItem],
          from: 0,
          size: DEFAULT_SITE_CONTENT_LIMIT,
          query: {
            queryString:
              'path:https://contoso.sharepoint.com/sites/team/* AND (contentClass:STS_ListItem_DocumentLibrary OR contentClass:STS_ListItem_WebPageLibrary)',
          },
          fields: [
            'title',
            'defaultEncodingURL',
            'lastModifiedTimeForRetention',
            PopularContentViewPeriod.Recent,
          ],
          sortProperties: [{ name: PopularContentViewPeriod.Recent, isDescending: true }],
        },
      ],
    });
  });

  it('returns content at least two years old without lifetime views', async () => {
    const now = new Date('2026-09-09T12:00:00.000Z');
    const staleBefore = new Date(now);
    staleBefore.setUTCFullYear(staleBefore.getUTCFullYear() - STALE_CONTENT_AGE_YEARS);
    jest.useFakeTimers().setSystemTime(now);
    post.mockResolvedValue({ value: [] });

    await expect(service.getStaleContent(userAccessToken, siteUrl)).resolves.toEqual([]);

    expect(post).toHaveBeenCalledWith({
      requests: [
        {
          entityTypes: [SearchEntityType.DriveItem, SearchEntityType.ListItem],
          from: 0,
          size: DEFAULT_SITE_CONTENT_LIMIT,
          query: {
            queryString: `path:https://contoso.sharepoint.com/sites/team/* AND (contentClass:STS_ListItem_DocumentLibrary OR contentClass:STS_ListItem_WebPageLibrary) AND lastModifiedTimeForRetention<=${staleBefore.toISOString()} AND (viewsLifetime=0 OR NOT viewsLifetime:*)`,
          },
          fields: [
            'title',
            'defaultEncodingURL',
            'lastModifiedTimeForRetention',
            PopularContentViewPeriod.Lifetime,
          ],
          sortProperties: [{ name: 'lastModifiedTimeForRetention', isDescending: false }],
        },
      ],
    });

    jest.useRealTimers();
  });
});
