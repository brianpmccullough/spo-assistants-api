import { Injectable } from '@nestjs/common';
import { RunContext, tool, Tool } from '@openai/agents';

import { RecentFilesService } from '../../graph/recent-files.service';
import type { AssistantExecutionContext } from '../models/assistant-execution-context';

/**
 * LLM-facing descriptor only. The Graph request itself belongs to RecentFilesService
 * so it stays usable without the Agents SDK.
 */
@Injectable()
export class ListRecentFilesTool {
  constructor(private readonly recentFilesService: RecentFilesService) {}

  create(): Tool<AssistantExecutionContext> {
    return tool({
      name: 'list_recent_files',
      description: 'Lists the most recently modified files on the current SharePoint site.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
      execute: async (input: unknown, context?: RunContext<AssistantExecutionContext>) => {
        if (!context) {
          throw new Error('The list_recent_files tool requires an assistant execution context');
        }

        const { user, sharePoint } = context.context;
        const files = await this.recentFilesService.listRecentFiles(
          user.accessToken,
          sharePoint.siteUrl,
        );
        return JSON.stringify(files);
      },
    });
  }
}
