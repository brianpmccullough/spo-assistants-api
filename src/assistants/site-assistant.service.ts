import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';

import { ChatIntegrityService } from './chat-integrity.service';
import type { AssistantConfiguration } from './models/assistant-configuration';
import { AssistantExecutionContext } from './models/assistant-execution-context';
import { ChatMessage } from './models/chat-message';
import { ChatRequest } from './models/chat-request';
import { ChatResponse } from './models/chat-response';
import { ChatRole } from './models/chat-role';
import { MAX_HISTORY_LENGTH } from './models/chat-state';
import { SiteAssistantLlmService } from './site-assistant-llm.service';
import { AuthenticatedUser } from '../auth/models/authenticated-user';

@Injectable()
export class SiteAssistantService {
  constructor(
    private readonly llm: SiteAssistantLlmService,
    private readonly integrity: ChatIntegrityService,
    // private readonly toolResolver: ToolResolverService,
    // private readonly promptBuilder: PromptBuilderService,
  ) {}

  // Stub. Placeholder values so the controller route compiles and responds;
  // the real configuration source is still being worked out.
  getConfiguration(): AssistantConfiguration {
    return {
      assistantId: 'site-assistant',
      greeting: 'Ask me about this site.',
      starterPrompts: [],
    };
  }

  async chat(user: AuthenticatedUser, chatRequest: ChatRequest): Promise<ChatResponse> {
    this.assertUserIsValid(user);
    this.assertChatStateIsValid(user, chatRequest);

    const chatId = chatRequest.state?.chatId ?? randomUUID();
    const priorHistory = chatRequest.state?.history ?? [];

    //const systemPrompt = await this.promptBuilder.build(dto.site);
    //const tools = await this.toolResolver.resolve(dto.tools ?? [], dto.site, userId);

    const messages: ChatMessage[] = this.trimHistory([
      ...priorHistory,
      { role: ChatRole.User, content: chatRequest.message, timestamp: Date.now() },
    ]);

    const executionContext: AssistantExecutionContext = {
      user,
      sharePoint: chatRequest.context,
    };
    const result = await this.llm.execute(executionContext, messages);
    //const result = { content: `you said...${chatRequest.message}` };

    const updatedHistory: ChatMessage[] = this.trimHistory([
      ...messages,
      { role: ChatRole.Assistant, content: result.content, timestamp: Date.now() },
    ]);

    return {
      message: result.content,
      state: {
        chatId,
        history: updatedHistory,
        signature: this.integrity.sign(user, updatedHistory),
      },
      //toolInvocations: result.toolCalls,
    };
  }

  private trimHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.length > MAX_HISTORY_LENGTH
      ? messages.slice(messages.length - MAX_HISTORY_LENGTH)
      : messages;
  }

  private assertUserIsValid(user: AuthenticatedUser): void {
    if (!user || user?.accessToken.length === 0) {
      throw new UnauthorizedException('Invalid user');
    }
  }

  private assertChatStateIsValid(user: AuthenticatedUser, chatRequest: ChatRequest): void {
    if (chatRequest.state) {
      if (!this.integrity.verify(user, chatRequest.state.history, chatRequest.state.signature)) {
        throw new BadRequestException('Invalid chat state');
      }
    }
  }
}
