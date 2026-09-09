import { Controller, Get, Req } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/models/authenticated-request';
import { GraphClient } from '../graph/graph-client';
import type { CurrentUser } from '../graph/models/current-user';

@Controller('me')
export class MeController {
  constructor(private readonly graphClient: GraphClient) {}

  @Get()
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<CurrentUser> {
    return this.graphClient.getCurrentUser(request.user.accessToken);
  }
}
