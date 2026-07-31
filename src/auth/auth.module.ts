import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { MicrosoftBearerTokenGuard } from './microsoft-bearer-token.guard';
import { ConfigurationModule } from '../configuration/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [{ provide: APP_GUARD, useClass: MicrosoftBearerTokenGuard }],
})
export class AuthModule {}
