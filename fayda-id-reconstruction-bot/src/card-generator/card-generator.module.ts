import { Module } from '@nestjs/common';
import { CardGeneratorService } from './card-generator.service';
import { CanvasRenderer } from './canvas-renderer';
import { FrontPanelRenderer } from './front-panel-renderer';
import { BackPanelRenderer } from './back-panel-renderer';
import { A4LayoutService } from './a4-layout.service';
import { QrPayloadGenerator } from './qr-payload.generator';

@Module({
  providers: [CardGeneratorService, CanvasRenderer, FrontPanelRenderer, BackPanelRenderer, A4LayoutService, QrPayloadGenerator],
  exports: [CardGeneratorService, A4LayoutService],
})
export class CardGeneratorModule {}
