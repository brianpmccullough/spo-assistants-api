import type { User as GraphUser } from '@microsoft/microsoft-graph-types';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { GraphScopes } from './graph-scopes';
import type { CurrentUser } from './models/current-user';
import { OboTokenService } from '../auth/obo-token.service';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class GraphClient {
  constructor(private readonly oboTokenService: OboTokenService) {}

  async getCurrentUser(
    userAccessToken: string,
    scopes: GraphScopes[] = [GraphScopes.Default],
  ): Promise<CurrentUser> {
    const oboAccessToken = await this.acquireOboToken(userAccessToken, scopes);
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
    if (scopes.length !== 1) {
      throw new UnauthorizedException(
        'Microsoft Graph requests must use exactly one delegated resource scope',
      );
    }

    return this.oboTokenService.exchange(userAccessToken, scopes[0]);
  }
}
