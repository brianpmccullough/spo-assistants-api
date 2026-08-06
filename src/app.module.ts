import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssistantsModule } from './assistants/assistants.module';
import { AuthModule } from './auth/auth.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigurationModule, AuthModule, UsersModule, AssistantsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
