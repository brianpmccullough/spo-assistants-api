import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { MicrosoftBearerTokenGuard } from './microsoft-bearer-token.guard';
import { OboTokenService } from './obo-token.service';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [OboTokenService, { provide: APP_GUARD, useClass: MicrosoftBearerTokenGuard }],
  exports: [OboTokenService],
})
export class AuthModule {}
