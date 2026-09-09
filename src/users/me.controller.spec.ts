import { Test, TestingModule } from '@nestjs/testing';

import { MeController } from './me.controller';
import type { AuthenticatedRequest } from '../auth/models/authenticated-request';
import { GraphClient } from '../graph/graph-client';
import type { CurrentUser } from '../graph/models/current-user';

describe('MeController', () => {
  let meController: MeController;
  let graphClient: { getCurrentUser: jest.Mock };

  beforeEach(async () => {
    graphClient = { getCurrentUser: jest.fn() };
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: GraphClient, useValue: graphClient }],
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
      graphClient.getCurrentUser.mockResolvedValue(currentUser);
      const request = {
        user: { id: 'user-id', accessToken: 'test-access-token' },
      } as AuthenticatedRequest;

      const result = await meController.getCurrentUser(request);

      expect(graphClient.getCurrentUser).toHaveBeenCalledWith('test-access-token');
      expect(result).toEqual(currentUser);
    });
  });
});
