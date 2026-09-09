import { Injectable } from '@nestjs/common';
import { RunContext, tool, Tool } from '@openai/agents';

import { ToolNames } from './tool-names';
import type { AssistantExecutionContext } from '../models/assistant-execution-context';
import { SiteContentService } from '../site-content.service';

/**
 * LLM-facing descriptor only. The Graph request itself belongs to SiteContentService
 * so it stays usable without the Agents SDK.
 */
@Injectable()
export class FindStaleContentTool {
  constructor(private readonly siteContentService: SiteContentService) {}

  create(): Tool<AssistantExecutionContext> {
    return tool({
      name: ToolNames.FindStaleContent,
      description:
        'Lists files and site pages not modified for at least two years that have no lifetime views.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
      execute: async (input: unknown, context?: RunContext<AssistantExecutionContext>) => {
        if (!context) {
          throw new Error(
            `The ${ToolNames.FindStaleContent} tool requires an assistant execution context`,
          );
        }

        const { user, sharePoint } = context.context;
        const content = await this.siteContentService.getStaleContent(
          user.accessToken,
          sharePoint.siteUrl,
        );
        return JSON.stringify(content);
      },
    });
  }
}
