import { Controller, Get, Req } from '@nestjs/common';

import type { CurrentUser } from './current-user';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<CurrentUser> {
    return this.usersService.getCurrentUser(request.user.accessToken);
  }
}
