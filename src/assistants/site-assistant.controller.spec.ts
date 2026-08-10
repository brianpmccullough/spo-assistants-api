import { Test, TestingModule } from '@nestjs/testing';

import { ChatRequest } from './chat-request';
import { ChatRole } from './chat-role';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';

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
      request.messages = [{ role: ChatRole.User, content: 'hello' }];
      const response = {
        chatId: 'chat-1',
        message: { id: 'message-1', role: ChatRole.Assistant, content: 'hi' },
      };
      service.chat.mockResolvedValue(response);

      await expect(controller.chat(request)).resolves.toBe(response);
      expect(service.chat).toHaveBeenCalledWith(request);
    });
  });
});
