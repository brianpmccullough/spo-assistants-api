import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import { ChatIntegrityService } from './chat-integrity.service';
import { ChatMessage } from './chat-message';
import { ChatRequest } from './chat-request';
import { ChatRole } from './chat-role';
import { MAX_HISTORY_LENGTH } from './chat-state';
import { SiteAssistantLlmService } from './site-assistant-llm.service';
import { SiteAssistantService } from './site-assistant.service';
import { AuthenticatedUser } from '../auth/authenticated-user';

function buildHistory(length: number): ChatMessage[] {
  return Array.from({ length }, (_, index) => ({
    role: index % 2 === 0 ? ChatRole.User : ChatRole.Assistant,
    content: `message ${index}`,
    timestamp: index,
  }));
}

describe('SiteAssistantService', () => {
  const user: AuthenticatedUser = { id: 'user-1', accessToken: 'token' };

  let llm: { execute: jest.Mock<Promise<{ content: string }>, [unknown, ChatMessage[]]> };
  let integrity: { sign: jest.Mock; verify: jest.Mock };
  let service: SiteAssistantService;

  beforeEach(() => {
    llm = {
      execute: jest
        .fn<Promise<{ content: string }>, [unknown, ChatMessage[]]>()
        .mockResolvedValue({ content: 'response' }),
    };
    integrity = {
      sign: jest.fn().mockReturnValue('new-signature'),
      verify: jest.fn().mockReturnValue(true),
    };

    service = new SiteAssistantService(
      llm as unknown as SiteAssistantLlmService,
      integrity as unknown as ChatIntegrityService,
    );
  });

  function buildRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
    const request = new ChatRequest();
    request.message = 'hello';
    request.context = { siteUrl: 'https://contoso.sharepoint.com/sites/team' };
    return Object.assign(request, overrides);
  }

  it('rejects a user with no access token', async () => {
    await expect(service.chat({ id: 'user-1', accessToken: '' }, buildRequest())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a chat state that fails signature verification', async () => {
    integrity.verify.mockReturnValue(false);
    const request = buildRequest({
      state: { chatId: 'chat-1', history: buildHistory(2), signature: 'bad-signature' },
    });

    await expect(service.chat(user, request)).rejects.toThrow(BadRequestException);
  });

  it('sends the LLM a message list capped at the configured history length', async () => {
    const request = buildRequest({
      state: {
        chatId: 'chat-1',
        history: buildHistory(MAX_HISTORY_LENGTH + 10),
        signature: 'signature',
      },
    });

    await service.chat(user, request);

    const messagesSentToLlm = llm.execute.mock.calls[0][1];
    expect(messagesSentToLlm).toHaveLength(MAX_HISTORY_LENGTH);
    expect(messagesSentToLlm[messagesSentToLlm.length - 1]).toMatchObject({
      role: ChatRole.User,
      content: 'hello',
    });
  });

  it('returns a signed state whose history never exceeds the configured maximum', async () => {
    const request = buildRequest({
      state: {
        chatId: 'chat-1',
        history: buildHistory(MAX_HISTORY_LENGTH),
        signature: 'signature',
      },
    });

    const response = await service.chat(user, request);

    expect(response.state.history.length).toBeLessThanOrEqual(MAX_HISTORY_LENGTH);
    expect(integrity.sign).toHaveBeenCalledWith(user, response.state.history);
  });
});
