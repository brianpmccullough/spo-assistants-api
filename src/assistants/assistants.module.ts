import { Module } from '@nestjs/common';

import { SiteAssistantController } from './site-assistant.controller';

@Module({
  controllers: [SiteAssistantController],
})
export class AssistantsModule {}
