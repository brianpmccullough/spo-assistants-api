import { Module } from '@nestjs/common';

import { ChatIntegrityService } from './chat-integrity.service';
import { SiteAssistantLlmService } from './site-assistant-llm.service';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';
import { SiteContentService } from './site-content.service';
import { GetPopularContentTool } from './tools/get-popular-content.tool';
import { ListRecentFilesTool } from './tools/list-recent-files.tool';
import { ConfigurationModule } from '../configuration/configuration.module';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [ConfigurationModule, GraphModule],
  controllers: [SiteAssistantController],
  providers: [
    ChatIntegrityService,
    GetPopularContentTool,
    ListRecentFilesTool,
    SiteAssistantLlmService,
    SiteAssistantService,
    SiteContentService,
  ],
})
export class AssistantsModule {}
