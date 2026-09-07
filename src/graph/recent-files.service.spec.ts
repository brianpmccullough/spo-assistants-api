import type { GraphTokenService } from './graph-token.service';
import { DEFAULT_RECENT_FILES_LIMIT, RecentFilesService } from './recent-files.service';

describe('RecentFilesService', () => {
  const userAccessToken = 'user-access-token';
  const graphAccessToken = 'graph-access-token';
  const siteUrl = 'https://contoso.sharepoint.com/sites/team';

  let post: jest.Mock;
  let graphTokenService: { exchangeForGraphToken: jest.Mock };
  let graphClientFactory: { create: jest.Mock };
  let service: RecentFilesService;

  beforeEach(() => {
    post = jest.fn();
    graphTokenService = { exchangeForGraphToken: jest.fn().mockResolvedValue(graphAccessToken) };
    graphClientFactory = {
      create: jest.fn().mockReturnValue({ api: jest.fn().mockReturnValue({ post }) }),
    };
    service = new RecentFilesService(
      graphTokenService as unknown as GraphTokenService,
      graphClientFactory,
    );
  });

  it('searches the current site with the delegated Graph token and returns usable files', async () => {
    post.mockResolvedValue({
      value: [
        {
          hitsContainers: [
            {
              hits: [
                {
                  resource: {
                    name: 'Quarterly report.docx',
                    webUrl:
                      'https://contoso.sharepoint.com/sites/team/Shared%20Documents/report.docx',
                    lastModifiedDateTime: '2026-09-07T10:00:00Z',
                  },
                },
                { resource: { name: 'Incomplete result' } },
              ],
            },
          ],
        },
      ],
    });

    await expect(service.listRecentFiles(userAccessToken, siteUrl)).resolves.toEqual([
      {
        name: 'Quarterly report.docx',
        webUrl: 'https://contoso.sharepoint.com/sites/team/Shared%20Documents/report.docx',
        lastModifiedDateTime: '2026-09-07T10:00:00Z',
      },
    ]);

    expect(graphTokenService.exchangeForGraphToken).toHaveBeenCalledWith(userAccessToken);
    expect(graphClientFactory.create).toHaveBeenCalledWith(graphAccessToken);
    expect(post).toHaveBeenCalledWith({
      requests: [
        {
          entityTypes: ['driveItem'],
          from: 0,
          size: DEFAULT_RECENT_FILES_LIMIT,
          query: {
            queryString: 'path:"https://contoso.sharepoint.com/sites/team/*" AND isDocument:1',
          },
          fields: ['name', 'webUrl', 'lastModifiedDateTime'],
          sortProperties: [{ name: 'lastModifiedDateTime', isDescending: true }],
        },
      ],
    });
  });
});
