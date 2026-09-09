import { Injectable } from '@nestjs/common';
import { RunContext, tool, Tool } from '@openai/agents';

import { ToolNames } from './tool-names';
import type { AssistantExecutionContext } from '../models/assistant-execution-context';
import {
  POPULAR_CONTENT_VIEW_PERIODS,
  PopularContentViewPeriod,
} from '../models/site-content-item';
import { DEFAULT_POPULAR_CONTENT_VIEW_PERIOD, SiteContentService } from '../site-content.service';

/**
 * LLM-facing descriptor only. The Graph request itself belongs to SiteContentService
 * so it stays usable without the Agents SDK.
 */
@Injectable()
export class GetPopularContentTool {
  constructor(private readonly siteContentService: SiteContentService) {}

  create(): Tool<AssistantExecutionContext> {
    return tool({
      name: ToolNames.GetPopularContent,
      description: 'Lists the most-viewed (i.e. popular) content on the current SharePoint site.',
      parameters: {
        type: 'object',
        properties: {
          viewPeriod: {
            type: 'string',
            enum: POPULAR_CONTENT_VIEW_PERIODS,
            default: DEFAULT_POPULAR_CONTENT_VIEW_PERIOD,
            description: `The view-count period to sort by. Defaults to ${DEFAULT_POPULAR_CONTENT_VIEW_PERIOD}, which covers the last 14 days.`,
          },
        },
        required: [],
        additionalProperties: false,
      },
      strict: true,
      execute: async (input: unknown, context?: RunContext<AssistantExecutionContext>) => {
        if (!context) {
          throw new Error(
            `The ${ToolNames.GetPopularContent} tool requires an assistant execution context`,
          );
        }

        const viewPeriod = this.parseViewPeriod(input);
        const { user, sharePoint } = context.context;
        const content = await this.siteContentService.getPopularContent(
          user,
          sharePoint.siteUrl,
          viewPeriod,
        );
        return JSON.stringify(content);
      },
    });
  }

  private parseViewPeriod(input: unknown): PopularContentViewPeriod {
    if (typeof input !== 'object' || input === null) {
      throw new Error(`The ${ToolNames.GetPopularContent} tool requires an object input`);
    }

    const viewPeriod = (input as Record<string, unknown>).viewPeriod;
    if (viewPeriod === undefined) {
      return DEFAULT_POPULAR_CONTENT_VIEW_PERIOD;
    }

    if (
      typeof viewPeriod === 'string' &&
      POPULAR_CONTENT_VIEW_PERIODS.includes(viewPeriod as PopularContentViewPeriod)
    ) {
      return viewPeriod as PopularContentViewPeriod;
    }

    throw new Error(`The ${ToolNames.GetPopularContent} tool received an unsupported view period`);
  }
}
