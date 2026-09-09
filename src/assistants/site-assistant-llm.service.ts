import { Injectable, Logger } from '@nestjs/common';
import { Agent, AgentInputItem, OpenAIProvider, RunContext, Runner, Tool } from '@openai/agents';
import { AzureOpenAI } from 'openai';

import { AssistantExecutionContext } from './models/assistant-execution-context';
import { ChatMessage } from './models/chat-message';
import { ChatRole } from './models/chat-role';
import { LlmResult } from './models/llm-result';
import { FindStaleContentTool } from './tools/find-stale-content.tool';
import { GetPopularContentTool } from './tools/get-popular-content.tool';
import { ListRecentFilesTool } from './tools/list-recent-files.tool';
import { ConfigurationService } from '../configuration/configuration.service';

const SITE_ASSISTANT_NAME: string = 'Site Assistant';

@Injectable()
export class SiteAssistantLlmService {
  private readonly logger = new Logger(SiteAssistantLlmService.name);
  private readonly runner: Runner;
  private readonly tools: Tool<AssistantExecutionContext>[];
  private readonly agent: Agent<AssistantExecutionContext>;

  // TODO: consider some other patterns here to lighten this constructor
  // and perhaps promote testability.
  constructor(
    configuration: ConfigurationService,
    findStaleContentTool: FindStaleContentTool,
    getPopularContentTool: GetPopularContentTool,
    listRecentFilesTool: ListRecentFilesTool,
  ) {
    const openAIClient = new AzureOpenAI({
      endpoint: configuration.settings.azureOpenAiEndpoint,
      apiVersion: configuration.settings.azureOpenAiApiVersion,
      apiKey: configuration.secrets.azureOpenAiApiKey,
      deployment: configuration.settings.azureOpenAiDeployment,
    });

    const modelProvider = new OpenAIProvider({
      openAIClient,
      useResponses: false,
    });

    this.runner = new Runner({ modelProvider, tracingDisabled: true });

    this.tools = [
      findStaleContentTool.create(),
      getPopularContentTool.create(),
      listRecentFilesTool.create(),
    ];

    this.agent = new Agent<AssistantExecutionContext>({
      name: SITE_ASSISTANT_NAME,
      model: configuration.settings.azureOpenAiDeployment,
      instructions: this.buildInstructions,
      tools: this.tools,
      modelSettings: { maxTokens: configuration.settings.azureOpenAiMaxOutputTokens },
    });
  }

  async execute(context: AssistantExecutionContext, messages: ChatMessage[]): Promise<LlmResult> {
    const input = this.buildInput(messages);

    const result = await this.runner.run(this.agent, input, {
      context,
      maxTurns: 10,
    });

    return {
      content: result.finalOutput ?? '',
      // extract tool invocations from result.newItems if you need them
      tokenUsage: {
        inputTokens: result.state?.usage?.inputTokens || 0,
        outputTokens: result.state?.usage?.outputTokens || 0,
        totalTokens: result.state?.usage?.totalTokens || 0,
      },
    };
  }

  private buildInput(messages: ChatMessage[]): AgentInputItem[] {
    return [
      ...messages.map((m) =>
        m.role === ChatRole.Assistant
          ? {
              role: 'assistant' as const,
              status: 'completed' as const,
              content: [{ type: 'output_text' as const, text: m.content }],
            }
          : {
              role: 'user' as const,
              content: m.content,
            },
      ),
    ];
  }

  // An arrow property rather than a method: the Agents SDK stores this and later
  // calls it with no receiver, so a plain method would see `this === undefined`
  // the moment its body starts using instance state.
  private readonly buildInstructions = (context: RunContext<AssistantExecutionContext>): string => {
    const { siteUrl } = context.context.sharePoint;

    const lines = [
      `You are '${SITE_ASSISTANT_NAME}', an AI assistant for the SharePoint Online site: ${siteUrl}`,
      '',
      'Rules:',
      '- Only answer questions using information returned from your available tools.',
      '- Decline any question or dialouge that is not grounded in information retrieved from tool or capabilities calls.',
      '- Be professional, concise, and direct',
      '',
      'DO NOT:',
      '- DO NOT describe, suggest, or give examples of possible capabilities or remedies that exceed what configured tools can help accomplish.',
    ];

    return lines.join('\n');
  };
}
