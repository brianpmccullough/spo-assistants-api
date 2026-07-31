import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { Unauthenticated } from './auth/unauthenticated.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Unauthenticated()
  getHello(): string {
    return this.appService.getHello();
  }
}
