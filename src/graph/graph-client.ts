import { ConfidentialClientApplication } from '@azure/msal-node';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { GraphTransport } from './graph-transport';
import { UserScopedGraph } from './user-scoped-graph';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class GraphClient {
  /**
   * Held for the lifetime of the application on purpose: MSAL's token cache lives
   * on the instance, so constructing one per request would mean an on-behalf-of
   * exchange on every call.
   */
  private readonly confidentialClientApplication: ConfidentialClientApplication;

  constructor(configurationService: ConfigurationService) {
    const { azureAdApiClientId, azureAdTenantId } = configurationService.settings;
    const { azureAdClientSecret } = configurationService.secrets;

    this.confidentialClientApplication = new ConfidentialClientApplication({
      auth: {
        clientId: azureAdApiClientId,
        authority: `https://login.microsoftonline.com/${azureAdTenantId}`,
        clientSecret: azureAdClientSecret,
      },
    });
  }

  /**
   * Microsoft Graph acting on behalf of the signed-in user, given the bearer
   * token that arrived at this API.
   */
  asUser(userAccessToken: string): UserScopedGraph {
    const transport = new GraphTransport((scopes) =>
      this.acquireOnBehalfOfToken(userAccessToken, scopes),
    );
    return new UserScopedGraph(transport);
  }

  private async acquireOnBehalfOfToken(
    userAccessToken: string,
    scopes: readonly string[],
  ): Promise<string> {
    const result = await this.confidentialClientApplication.acquireTokenOnBehalfOf({
      oboAssertion: userAccessToken,
      scopes: [...scopes],
    });

    if (!result?.accessToken) {
      throw new UnauthorizedException(
        'Failed to acquire an on-behalf-of token for Microsoft Graph',
      );
    }
    return result.accessToken;
  }
}
