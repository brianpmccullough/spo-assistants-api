import { Injectable } from '@nestjs/common';
import { RunContext, tool, Tool } from '@openai/agents';

import { ToolNames } from './tool-names';
import type { AssistantExecutionContext } from '../models/assistant-execution-context';
import { SiteContentService } from '../site-content.service';

interface GetPageContentInput {
  readonly pageUrl?: string;
}

/** Reads a modern page's canvas through its SharePoint list item. */
@Injectable()
export class GetPageContentTool {
  constructor(private readonly siteContentService: SiteContentService) {}

  create(): Tool<AssistantExecutionContext> {
    return tool({
      name: ToolNames.GetPageContent,
      description:
        'Reads a SharePoint page content. Use it to summarize a page or answer questions about information on it. Defaults to the current page.',
      parameters: {
        type: 'object',
        properties: {
          pageUrl: {
            type: 'string',
            description:
              'The full URL of the SharePoint page to read. Omit to read the current page.',
          },
        },
        required: [],
        additionalProperties: false,
      },
      strict: true,
      execute: async (input: unknown, context?: RunContext<AssistantExecutionContext>) => {
        if (!context) {
          throw new Error(
            `The ${ToolNames.GetPageContent} tool requires an assistant execution context`,
          );
        }

        const { user, sharePoint } = context.context;
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
          throw new Error(`The ${ToolNames.GetPageContent} tool requires an object input`);
        }

        const { pageUrl } = input as GetPageContentInput;
        if (pageUrl !== undefined && typeof pageUrl !== 'string') {
          throw new Error(`The ${ToolNames.GetPageContent} tool requires pageUrl to be a string`);
        }

        const resolvedPageUrl = pageUrl ?? sharePoint.pageUrl;
        if (!resolvedPageUrl) {
          throw new Error(
            `The ${ToolNames.GetPageContent} tool requires a page URL or current page context`,
          );
        }

        const content = await this.siteContentService.getPageContent(
          user,
          sharePoint.siteUrl,
          resolvedPageUrl,
        );
        return JSON.stringify(content);
      },
    });
  }
}
