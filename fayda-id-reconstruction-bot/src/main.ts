import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

const REQUIRED_ASSETS = [
  'bg_combined.png',
  'bg_combined2.png',
  'fonts/NotoSansEthiopic-VariableFont_wdth,wght.ttf',
  'fonts/Roboto-VariableFont_wdth,wght.ttf',
];

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.error('FATAL: TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  const assetsDir = path.join(process.cwd(), 'assets');
  const missing = REQUIRED_ASSETS.filter((file) => !fs.existsSync(path.join(assetsDir, file)));
  if (missing.length > 0) {
    logger.error(`FATAL: Missing required asset files:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  if (!process.env.NVIDIA_API_KEY && !process.env.NGC_API_KEY) {
    logger.warn('NVIDIA API key is not configured - portrait extraction will use heuristic crop fallback');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  logger.log('Fayda ID Reconstruction Bot is running');
}

bootstrap();
