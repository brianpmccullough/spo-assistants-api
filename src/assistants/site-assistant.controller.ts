import { Body, Controller, Post } from '@nestjs/common';

@Controller('assistants/site-assistant')
export class SiteAssistantController {
  @Post('chat')
  chat(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return { ...body, serverDateTime: new Date().toISOString() };
  }
}
