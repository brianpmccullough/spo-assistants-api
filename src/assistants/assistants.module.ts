import { Module } from '@nestjs/common';

import { ChatIntegrityService } from './chat-integrity.service';
import { ListRecentFilesTool } from './list-recent-files.tool';
import { SiteAssistantLlmService } from './site-assistant-llm.service';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';
import { ConfigurationModule } from '../configuration/configuration.module';
import { GraphModule } from '../graph/graph.module';

@Module({
  imports: [ConfigurationModule, GraphModule],
  controllers: [SiteAssistantController],
  providers: [
    ChatIntegrityService,
    ListRecentFilesTool,
    SiteAssistantLlmService,
    SiteAssistantService,
  ],
})
export class AssistantsModule {}
