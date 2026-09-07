import { Module } from '@nestjs/common';

import { ChatIntegrityService } from './chat-integrity.service';
import { SiteAssistantLlmService } from './site-assistant-llm.service';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  controllers: [SiteAssistantController],
  providers: [ChatIntegrityService, SiteAssistantLlmService, SiteAssistantService],
})
export class AssistantsModule {}
