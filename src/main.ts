import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

function getAllowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? 'https://localhost:4321')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`Application is running on: ${await app.getUrl()}`, 'Bootstrap');
}
bootstrap();
