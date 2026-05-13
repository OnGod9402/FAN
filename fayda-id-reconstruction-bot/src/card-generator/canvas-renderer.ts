import { Injectable } from '@nestjs/common';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { CARD_W, CARD_H, PANEL_W, PANEL_H, FONT } from './coords';

@Injectable()
export class CanvasRenderer {
  public sx(x: number): number {
    return Math.round((x * PANEL_W) / CARD_W);
  }

  public sy(y: number): number {
    return Math.round((y * PANEL_H) / CARD_H);
  }

  public scaledBox(b: { x: number; y: number; w: number; h: number }) {
    return { x: this.sx(b.x), y: this.sy(b.y), w: this.sx(b.w), h: this.sy(b.h) };
  }

  public getScale(): number {
    return Math.min(PANEL_W / CARD_W, PANEL_H / CARD_H);
  }

  public scaledFontSize(baseSize: number): number {
    return Math.max(7, Math.round(baseSize * this.getScale()));
  }

  public drawLabel(ctx: SKRSContext2D, text: string, x: number, y: number): void {
    const size = this.scaledFontSize(FONT.labelSize);
    ctx.font = `bold ${size}px Roboto`;
    ctx.fillStyle = '#555';
    ctx.fillText(text, x, y);
    ctx.fillStyle = '#1a1a1a';
  }

  public drawRotatedText(ctx: SKRSContext2D, text: string, x: number, y: number, fontSize: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `400 ${fontSize}px Roboto`;
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
