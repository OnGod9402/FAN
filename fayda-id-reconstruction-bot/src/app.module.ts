import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './telegram/telegram.module';
import { SessionModule } from './session/session.module';
import { OcrModule } from './ocr/ocr.module';
import { PhotoProcessorModule } from './photo-processor/photo-processor.module';
import { CardGeneratorModule } from './card-generator/card-generator.module';
import { HistoryModule } from './history/history.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SessionModule,
    OcrModule,
    PhotoProcessorModule,
    CardGeneratorModule,
    TelegramModule,
    HistoryModule,
  ],
})
export class AppModule {}
