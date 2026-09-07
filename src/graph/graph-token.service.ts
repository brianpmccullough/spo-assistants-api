import { ConfidentialClientApplication, OnBehalfOfRequest } from '@azure/msal-node';
import { Injectable } from '@nestjs/common';

import { GraphScopes } from './graph-scopes';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class GraphTokenService {
  private readonly client: ConfidentialClientApplication;
  private readonly scopes: GraphScopes[];

  constructor(configurationService: ConfigurationService) {
    const { azureAdApiClientId, azureAdTenantId } = configurationService.settings;
    const { azureAdClientSecret } = configurationService.secrets;

    this.client = new ConfidentialClientApplication({
      auth: {
        clientId: azureAdApiClientId,
        clientSecret: azureAdClientSecret,
        authority: `https://login.microsoftonline.com/${azureAdTenantId}`,
      },
    });

    this.scopes = [GraphScopes.Default];
  }

  async exchangeForGraphToken(
    accessToken: string,
    scopes: GraphScopes[] = this.scopes,
  ): Promise<string> {
    const request: OnBehalfOfRequest = {
      oboAssertion: accessToken,
      scopes,
    };

    const result = await this.client.acquireTokenOnBehalfOf(request);
    if (!result) {
      throw new Error('Unexpected result obtaining OnBehalfOf token.');
    }

    return result.accessToken;
  }
}
