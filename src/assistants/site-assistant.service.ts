import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Agent, run, type AgentInputItem } from '@openai/agents';
import { OpenAIChatCompletionsModel } from '@openai/agents-openai';
import type { AzureOpenAI } from 'openai';

import type { AssistantConfiguration } from './assistant-configuration';
import { AZURE_OPENAI_CLIENT } from './azure-openai-client';
import type { ChatMessage } from './chat-message';
import type { ChatRequest } from './chat-request';
import type { ChatRequestMessage } from './chat-request-message';
import type { ChatResponse } from './chat-response';
import { ChatRole } from './chat-role';
import { Milliseconds } from '../common/milliseconds';
import { ConfigurationService } from '../configuration/configuration.service';

const ASSISTANT_ID = 'site-assistant';

/**
 * Deadline for a single model run. Without one a stalled Azure OpenAI call holds the
 * request open until the platform ingress kills it, which the client cannot tell from
 * a hang. Revisit once tools exist — a tool loop makes several model calls under this
 * one budget.
 */
const RUN_TIMEOUT = Milliseconds.fromSeconds(60);

const INSTRUCTIONS = [
  'You are a helpful assistant embedded in a SharePoint Online site.',
  'Answer concisely. If you do not know something, say so rather than guessing.',
  'You have no tools yet, so you cannot look anything up in SharePoint.',
].join(' ');

// Frozen because a single instance is handed to every caller; without this one
// caller mutating `starterPrompts` would corrupt it process-wide.
const CONFIGURATION: AssistantConfiguration = Object.freeze({
  assistantId: ASSISTANT_ID,
  greeting: 'Ask me about this site.',
  starterPrompts: Object.freeze(['What can you help me with?', 'Summarize what this site is for.']),
});

@Injectable()
export class SiteAssistantService {
  private readonly logger = new Logger(SiteAssistantService.name);
  private readonly agent: Agent;

  constructor(
    @Inject(AZURE_OPENAI_CLIENT) client: AzureOpenAI,
    configuration: ConfigurationService,
  ) {
    this.agent = new Agent({
      name: ASSISTANT_ID,
      instructions: INSTRUCTIONS,
      // The model is passed explicitly rather than via the SDK's process-wide
      // default client, so the dependency arrives through DI and can be faked
      // in tests. Chat Completions rather than Responses because Azure's
      // Responses support varies by api-version, region, and deployment;
      // switching is a one-line change to OpenAIResponsesModel.
      model: new OpenAIChatCompletionsModel(client, configuration.settings.azureOpenAiDeployment),
    });
  }

  getConfiguration(): AssistantConfiguration {
    return CONFIGURATION;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const chatId = request.chatId ?? randomUUID();

    const result = await run(this.agent, SiteAssistantService.toAgentInput(request.messages), {
      signal: AbortSignal.timeout(RUN_TIMEOUT),
    });

    if (!result.finalOutput) {
      // A refusal, a content-filter block, or a malformed completion all land here and
      // would otherwise reach the user as a blank chat bubble with nothing logged.
      // Until the error contract exists, this is at least visible in the logs.
      this.logger.warn(`Model produced no output for chat ${chatId}`);
    }

    const message: ChatMessage = {
      id: randomUUID(),
      role: ChatRole.Assistant,
      content: result.finalOutput ?? '',
    };

    return {
      chatId,
      message,
    };
  }

  private static toAgentInput(messages: ChatRequestMessage[]): AgentInputItem[] {
    return messages.map((message) =>
      message.role === ChatRole.User
        ? { role: 'user' as const, content: message.content }
        : {
            role: 'assistant' as const,
            status: 'completed' as const,
            content: [{ type: 'output_text' as const, text: message.content }],
          },
    );
  }
}
