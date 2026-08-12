import { Test, TestingModule } from '@nestjs/testing';

import type { CurrentUser } from './current-user';
import { MeController } from './me.controller';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

describe('MeController', () => {
  let meController: MeController;
  let usersService: { getCurrentUser: jest.Mock };

  beforeEach(async () => {
    usersService = { getCurrentUser: jest.fn() };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    meController = app.get<MeController>(MeController);
  });

  describe('getCurrentUser', () => {
    it("resolves the current user via the request's access token", async () => {
      const currentUser: CurrentUser = {
        id: 'user-id',
        displayName: 'Test User',
        userPrincipalName: 'test.user@example.com',
      };
      usersService.getCurrentUser.mockResolvedValue(currentUser);
      const request = {
        user: { id: 'user-id', accessToken: 'test-access-token' },
      } as AuthenticatedRequest;

      const result = await meController.getCurrentUser(request);

      expect(usersService.getCurrentUser).toHaveBeenCalledWith('test-access-token');
      expect(result).toEqual(currentUser);
    });
  });
});
