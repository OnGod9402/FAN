import { Module } from '@nestjs/common';
import { LocalFaceService } from './local-face.service';
import { PhotoProcessorService } from './photo-processor.service';
import { BackgroundRemover } from './background-remover';

@Module({
  providers: [LocalFaceService, PhotoProcessorService, BackgroundRemover],
  exports: [PhotoProcessorService],
})
export class PhotoProcessorModule {}
