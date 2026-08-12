import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { CurrentUser } from './current-user';
import { GraphClient } from '../graph/graph-client';
import { GraphError } from '../graph/graph-error';

@Injectable()
export class UsersService {
  constructor(private readonly graphClient: GraphClient) {}

  async getCurrentUser(userAccessToken: string): Promise<CurrentUser> {
    try {
      const { id, displayName, userPrincipalName } = await this.graphClient
        .asUser(userAccessToken)
        .me.select('id', 'displayName', 'userPrincipalName')
        .get();

      // Graph types every field as optional and `$select` does not change that,
      // so the guarantee `CurrentUser` makes is established here.
      if (!id || !displayName || !userPrincipalName) {
        throw new Error('Microsoft Graph /me response is missing required user fields');
      }
      return { id, displayName, userPrincipalName };
    } catch (error) {
      // The Graph client reports transport failures as `GraphError`. Deciding
      // that a rejected /me means "unauthenticated caller" is this module's call,
      // not the client's.
      if (error instanceof GraphError) {
        throw new UnauthorizedException('Failed to retrieve user from Microsoft Graph');
      }
      throw error;
    }
  }
}
