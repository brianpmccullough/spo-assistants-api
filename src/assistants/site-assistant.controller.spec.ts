import { Test, TestingModule } from '@nestjs/testing';

import { ChatRequest } from './chat-request';
import type { ChatResponse } from './chat-response';
import { ChatRole } from './chat-role';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import type { AuthenticatedUser } from '../auth/authenticated-user';

describe('SiteAssistantController', () => {
  let controller: SiteAssistantController;
  let service: { chat: jest.Mock; getConfiguration: jest.Mock };

  beforeEach(async () => {
    service = {
      chat: jest.fn(),
      getConfiguration: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [SiteAssistantController],
      providers: [{ provide: SiteAssistantService, useValue: service }],
    }).compile();

    controller = app.get<SiteAssistantController>(SiteAssistantController);
  });

  describe('getConfiguration', () => {
    it('returns the assistant configuration from the service', () => {
      const configuration = {
        assistantId: 'site-assistant',
        greeting: 'Ask me about this site.',
        starterPrompts: ['What can you help me with?'],
      };
      service.getConfiguration.mockReturnValue(configuration);

      expect(controller.getConfiguration()).toBe(configuration);
    });
  });

  describe('chat', () => {
    it('delegates to the service and returns its response', async () => {
      const request = new ChatRequest();
      request.message = 'hello';
      request.context = { siteUrl: 'https://contoso.sharepoint.com/sites/team' };

      const user: AuthenticatedUser = { id: 'user-1', accessToken: 'token' };
      const httpRequest = { user } as AuthenticatedRequest;

      const response: ChatResponse = {
        message: 'hi',
        state: {
          chatId: 'chat-1',
          history: [{ role: ChatRole.Assistant, content: 'hi', timestamp: 0 }],
          signature: 'signature',
        },
      };
      service.chat.mockResolvedValue(response);

      await expect(controller.chat(httpRequest, request)).resolves.toBe(response);
      expect(service.chat).toHaveBeenCalledWith(user, request);
    });
  });
});
