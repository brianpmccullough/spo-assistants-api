import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AssistantsModule } from './assistants/assistants.module';
import { AuthModule } from './auth/auth.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [ConfigurationModule, AuthModule, UsersModule, AssistantsModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Registered in the module graph rather than at bootstrap so tests and any
      // alternate host get the same validation the HTTP server does.
      //
      // `whitelist` strips properties with no decorator on the DTO, and
      // `forbidNonWhitelisted` is deliberately left off: a newer tenant-deployed
      // client sending a field this server does not know about is tolerated
      // (the field is dropped) rather than rejected with a 400.
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}
