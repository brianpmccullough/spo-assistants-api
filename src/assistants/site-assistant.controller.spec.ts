import { Test, TestingModule } from '@nestjs/testing';

import { SiteAssistantController } from './site-assistant.controller';

describe('SiteAssistantController', () => {
  let controller: SiteAssistantController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SiteAssistantController],
    }).compile();

    controller = app.get<SiteAssistantController>(SiteAssistantController);
  });

  describe('chat', () => {
    it('echoes the request body back with the server date/time', () => {
      const before = Date.now();

      const result = controller.chat({ message: 'hello' });

      expect(result.message).toBe('hello');
      expect(typeof result.serverDateTime).toBe('string');
      const parsed = new Date(result.serverDateTime as string).getTime();
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(Date.now());
    });
  });
});
