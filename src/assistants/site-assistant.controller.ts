import { Body, Controller, Get, Post } from '@nestjs/common';

import type { AssistantConfiguration } from './assistant-configuration';
import { ChatRequest } from './chat-request';
import type { ChatResponse } from './chat-response';
import { SiteAssistantService } from './site-assistant.service';

@Controller('assistants/site-assistant')
export class SiteAssistantController {
  constructor(private readonly siteAssistantService: SiteAssistantService) {}

  @Get()
  getConfiguration(): AssistantConfiguration {
    return this.siteAssistantService.getConfiguration();
  }

  @Post('chat')
  chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    return this.siteAssistantService.chat(request);
  }
}
