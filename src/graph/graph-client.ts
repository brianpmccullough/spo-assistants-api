import { ConfidentialClientApplication } from '@azure/msal-node';
import type { User as GraphUser } from '@microsoft/microsoft-graph-types';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { CurrentUser } from './current-user';
import { ConfigurationService } from '../configuration/configuration.service';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const USER_READ_SCOPE = 'https://graph.microsoft.com/User.Read';

@Injectable()
export class GraphClient {
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

  async getCurrentUser(userAccessToken: string): Promise<CurrentUser> {
    const oboAccessToken = await this.acquireOboToken(userAccessToken, [USER_READ_SCOPE]);
    const response = await fetch(`${GRAPH_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${oboAccessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to retrieve user from Microsoft Graph');
    }

    const graphUser = (await response.json()) as GraphUser;
    return GraphClient.toCurrentUser(graphUser);
  }

  private static toCurrentUser(graphUser: GraphUser): CurrentUser {
    const { id, displayName, userPrincipalName } = graphUser;
    if (!id || !displayName || !userPrincipalName) {
      throw new Error('Microsoft Graph /me response is missing required user fields');
    }
    return { id, displayName, userPrincipalName };
  }

  private async acquireOboToken(userAccessToken: string, scopes: string[]): Promise<string> {
    const result = await this.confidentialClientApplication.acquireTokenOnBehalfOf({
      oboAssertion: userAccessToken,
      scopes,
    });

    if (!result?.accessToken) {
      throw new UnauthorizedException(
        'Failed to acquire an on-behalf-of token for Microsoft Graph',
      );
    }
    return result.accessToken;
  }
}
