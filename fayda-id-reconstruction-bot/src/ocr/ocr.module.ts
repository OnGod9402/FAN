import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { FrontCardParser } from './front-card-parser';
import { BackCardParser } from './back-card-parser';
import { ImageClassifier } from './image-classifier';

@Module({
  providers: [OcrService, FrontCardParser, BackCardParser, ImageClassifier],
  exports: [OcrService],
})
export class OcrModule {}

