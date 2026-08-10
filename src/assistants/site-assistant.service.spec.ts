// class-validator/class-transformer decorators on the chat models below are
// applied at import time and need reflect-metadata; nothing boots Nest here.
import 'reflect-metadata';

import { run, type AgentInputItem } from '@openai/agents';
import type { AzureOpenAI } from 'openai';

import { ChatRequest } from './chat-request';
import { ChatRequestMessage } from './chat-request-message';
import { ChatRole } from './chat-role';
import { SiteAssistantService } from './site-assistant.service';
import { ConfigurationService } from '../configuration/configuration.service';

jest.mock('@openai/agents', () => ({
  ...jest.requireActual<typeof import('@openai/agents')>('@openai/agents'),
  run: jest.fn(),
}));

const runMock = run as unknown as jest.Mock;

function buildService(): SiteAssistantService {
  const configuration = {
    settings: { azureOpenAiDeployment: 'gpt-4o-mini' },
  } as ConfigurationService;

  return new SiteAssistantService({} as AzureOpenAI, configuration);
}

function buildMessage(role: ChatRole, content: string): ChatRequestMessage {
  const message = new ChatRequestMessage();
  message.role = role;
  message.content = content;
  return message;
}

describe('SiteAssistantService', () => {
  beforeEach(() => {
    runMock.mockReset();
  });

  describe('getConfiguration', () => {
    it('returns a greeting and starter prompts', () => {
      const configuration = buildService().getConfiguration();

      expect(configuration.assistantId).toBe('site-assistant');
      expect(configuration.greeting).toBeTruthy();
      expect(configuration.starterPrompts.length).toBeGreaterThan(0);
    });
  });

  describe('chat', () => {
    it('maps user and assistant history into agent input items', async () => {
      runMock.mockResolvedValue({ finalOutput: 'the answer' });
      const request = new ChatRequest();
      request.messages = [
        buildMessage(ChatRole.User, 'first question'),
        buildMessage(ChatRole.Assistant, 'first answer'),
        buildMessage(ChatRole.User, 'second question'),
      ];

      await buildService().chat(request);

      expect(runMock).toHaveBeenCalledTimes(1);
      const [, agentInput] = runMock.mock.calls[0] as [unknown, AgentInputItem[]];
      expect(agentInput).toEqual([
        { role: 'user', content: 'first question' },
        {
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'first answer' }],
        },
        { role: 'user', content: 'second question' },
      ]);
    });

    it('runs the agent under an abort signal so a stalled model call cannot hang', async () => {
      runMock.mockResolvedValue({ finalOutput: 'the answer' });
      const request = new ChatRequest();
      request.messages = [buildMessage(ChatRole.User, 'hello')];

      await buildService().chat(request);

      const [, , options] = runMock.mock.calls[0] as [unknown, unknown, { signal: AbortSignal }];
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('mints a chatId when the request does not carry one', async () => {
      runMock.mockResolvedValue({ finalOutput: 'the answer' });
      const request = new ChatRequest();
      request.messages = [buildMessage(ChatRole.User, 'hello')];

      const response = await buildService().chat(request);

      expect(response.chatId).toEqual(expect.any(String));
      expect(response.chatId.length).toBeGreaterThan(0);
      expect(response.message.id).toEqual(expect.any(String));
      expect(response.message.role).toBe(ChatRole.Assistant);
      expect(response.message.content).toBe('the answer');
    });

    it('preserves the chatId the client sends back', async () => {
      runMock.mockResolvedValue({ finalOutput: 'the answer' });
      const request = new ChatRequest();
      request.chatId = 'existing-chat';
      request.messages = [buildMessage(ChatRole.User, 'hello')];

      const response = await buildService().chat(request);

      expect(response.chatId).toBe('existing-chat');
    });

    it('returns empty content when the model produces no output', async () => {
      runMock.mockResolvedValue({ finalOutput: undefined });
      const request = new ChatRequest();
      request.messages = [buildMessage(ChatRole.User, 'hello')];

      const response = await buildService().chat(request);

      expect(response.message.content).toBe('');
    });
  });
});
