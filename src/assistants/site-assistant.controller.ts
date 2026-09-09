import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import type { AssistantConfiguration } from './models/assistant-configuration';
import { ChatRequest } from './models/chat-request';
import type { ChatResponse } from './models/chat-response';
import { SiteAssistantService } from './site-assistant.service';
import type { AuthenticatedRequest } from '../auth/models/authenticated-request';

@Controller('assistants/site-assistant')
export class SiteAssistantController {
  constructor(private readonly siteAssistantService: SiteAssistantService) {}

  @Get()
  getConfiguration(): AssistantConfiguration {
    return this.siteAssistantService.getConfiguration();
  }

  @Post('chat')
  chat(
    @Req() httpRequest: AuthenticatedRequest,
    @Body() request: ChatRequest,
  ): Promise<ChatResponse> {
    return this.siteAssistantService.chat(httpRequest.user, request);
  }
}
