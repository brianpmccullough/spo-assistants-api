import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigurationService } from './configuration/configuration.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configuration = app.get(ConfigurationService);

  app.enableCors({
    origin: configuration.settings.corsAllowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(configuration.settings.port);
  Logger.log(`Application is running on: ${await app.getUrl()}`, 'Bootstrap');
}
void bootstrap();
