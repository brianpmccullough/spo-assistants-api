import { ConfidentialClientApplication, OnBehalfOfRequest } from '@azure/msal-node';
import { Injectable } from '@nestjs/common';

import { ConfigurationService } from '../configuration/configuration.service';

/** Acquires delegated access tokens for downstream Microsoft resources. */
@Injectable()
export class OboTokenService {
  private readonly client: ConfidentialClientApplication;

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
  }

  async exchange(userAccessToken: string, scope: string): Promise<string> {
    const request: OnBehalfOfRequest = {
      oboAssertion: userAccessToken,
      scopes: [scope],
    };

    const result = await this.client.acquireTokenOnBehalfOf(request);
    if (!result?.accessToken) {
      throw new Error('Unexpected result obtaining an on-behalf-of token.');
    }

    return result.accessToken;
  }
}
