import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;

// Original digital generation size
const CARD_W = 1920;
const CARD_H = 544;
const PANEL_W = 960;

// Adding the top margin back and increasing the side margins slightly as requested
const MARGIN_X = 135; // Increased margin by exactly 5px per side as requested
const RENDERED_W = A4_WIDTH - (MARGIN_X * 2);
const scale = RENDERED_W / CARD_W;
const RENDERED_H = Math.round(CARD_H * scale) + 5;
const RENDERED_PANEL_W = Math.round(RENDERED_W / 2);

@Injectable()
export class A4LayoutService {
  private readonly logger = new Logger(A4LayoutService.name);

  async generateA4Mirrored(cardBuffers: Buffer[]): Promise<Buffer> {
    if (cardBuffers.length === 0) {
      throw new Error('No cards provided to print');
    }

    const canvas = createCanvas(A4_WIDTH, A4_HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

    const maxPerPage = 5;
    const totalCards = Math.min(cardBuffers.length, maxPerPage);

    // This restores the top margin and calculates even gaps
    const totalCardsHeight = RENDERED_H * maxPerPage;
    const totalGap = A4_HEIGHT - totalCardsHeight;
    const gap = Math.round(totalGap / (maxPerPage + 1));

    for (let i = 0; i < totalCards; i++) {
      const img = await loadImage(cardBuffers[i]);
      const startX = MARGIN_X;
      const startY = gap + i * (RENDERED_H + gap);

      ctx.save();

      ctx.save();
      ctx.translate(startX + RENDERED_PANEL_W, startY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, PANEL_W, 0, PANEL_W, CARD_H, 0, 0, RENDERED_PANEL_W, RENDERED_H);
      ctx.restore();

      ctx.save();
      ctx.translate(startX + RENDERED_W, startY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, PANEL_W, CARD_H, 0, 0, RENDERED_PANEL_W, RENDERED_H);
      ctx.restore();

      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  }
}





