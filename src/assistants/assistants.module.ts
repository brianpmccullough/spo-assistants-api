import { Module } from '@nestjs/common';

import { AZURE_OPENAI_CLIENT, createAzureOpenAiClient } from './azure-openai-client';
import { SiteAssistantController } from './site-assistant.controller';
import { SiteAssistantService } from './site-assistant.service';
import { ConfigurationModule } from '../configuration/configuration.module';
import { ConfigurationService } from '../configuration/configuration.service';

@Module({
  imports: [ConfigurationModule],
  controllers: [SiteAssistantController],
  providers: [
    {
      provide: AZURE_OPENAI_CLIENT,
      inject: [ConfigurationService],
      useFactory: createAzureOpenAiClient,
    },
    SiteAssistantService,
  ],
})
export class AssistantsModule {}
