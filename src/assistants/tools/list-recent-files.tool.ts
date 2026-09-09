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
export class ListRecentFilesTool {
  constructor(private readonly siteContentService: SiteContentService) {}

  create(): Tool<AssistantExecutionContext> {
    return tool({
      name: ToolNames.ListRecentFiles,
      description:
        'Lists the most recently modified files and site pages on the current SharePoint site.',
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
            `The ${ToolNames.ListRecentFiles} tool requires an assistant execution context`,
          );
        }

        const { user, sharePoint } = context.context;
        const files = await this.siteContentService.getRecentContent(
          user.accessToken,
          sharePoint.siteUrl,
        );
        return JSON.stringify(files);
      },
    });
  }
}
