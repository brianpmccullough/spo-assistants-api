import { Controller, Get, Req } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { CurrentUser } from '../graph/current-user';
import { GraphClient } from '../graph/graph-client';

@Controller('me')
export class MeController {
  constructor(private readonly graphClient: GraphClient) {}

  @Get()
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<CurrentUser> {
    return this.graphClient.getCurrentUser(request.user.accessToken);
  }
}
