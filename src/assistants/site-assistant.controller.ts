import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import type { AssistantConfiguration } from './assistant-configuration';
import { ChatRequest } from './chat-request';
import type { ChatResponse } from './chat-response';
import { SiteAssistantService } from './site-assistant.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

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
