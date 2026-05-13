import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { BackgroundTaskService } from './background-task.service';
import { SessionModule } from '../session/session.module';
import { OcrModule } from '../ocr/ocr.module';
import { PhotoProcessorModule } from '../photo-processor/photo-processor.module';
import { CardGeneratorModule } from '../card-generator/card-generator.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [SessionModule, OcrModule, PhotoProcessorModule, CardGeneratorModule, HistoryModule],
  providers: [TelegramService, BackgroundTaskService],
})
export class TelegramModule {}
