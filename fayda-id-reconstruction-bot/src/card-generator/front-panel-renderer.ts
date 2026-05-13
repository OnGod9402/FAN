import { Injectable, Logger } from '@nestjs/common';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { loadImage } from '@napi-rs/canvas';
import * as bwipjs from 'bwip-js';
import { SessionData } from '../session/session.types';
import { FRONT, FONT } from './coords';
import { CanvasRenderer } from './canvas-renderer';

@Injectable()
export class FrontPanelRenderer {
  private readonly logger = new Logger(FrontPanelRenderer.name);

  constructor(private readonly canvasRenderer: CanvasRenderer) {}

  public async render(ctx: SKRSContext2D, session: SessionData, portrait: Buffer): Promise<void> {
    await this.drawPortrait(ctx, portrait, this.canvasRenderer.scaledBox(FRONT.portrait));
    await this.drawPortrait(ctx, portrait, this.canvasRenderer.scaledBox(FRONT.miniPortrait));
    this.paintFields(ctx, session);
    await this.drawFcn(ctx, session.fan ?? '');
  }

  private async drawPortrait(
    ctx: SKRSContext2D,
    buf: Buffer,
    box: { x: number; y: number; w: number; h: number },
  ): Promise<void> {
    try {
      const img = await loadImage(buf);
      const r = Math.max(8, Math.min(box.w, box.h) * 0.06); // corner radius

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x + r, box.y);
      ctx.lineTo(box.x + box.w - r, box.y);
      ctx.quadraticCurveTo(box.x + box.w, box.y, box.x + box.w, box.y + r);
      ctx.lineTo(box.x + box.w, box.y + box.h - r);
      ctx.quadraticCurveTo(box.x + box.w, box.y + box.h, box.x + box.w - r, box.y + box.h);
      ctx.lineTo(box.x + r, box.y + box.h);
      ctx.quadraticCurveTo(box.x, box.y + box.h, box.x, box.y + box.h - r);
      ctx.lineTo(box.x, box.y + r);
      ctx.quadraticCurveTo(box.x, box.y, box.x + r, box.y);
      ctx.closePath();
      ctx.clip();

      const imgRatio = img.width / img.height;
      const boxRatio = box.w / box.h;
      let drawW: number, drawH: number, drawX: number, drawY: number;

      // "cover" — fill the entire box, crop overflow, anchor to top
      if (imgRatio > boxRatio) {
        // Image wider than box → match height, center horizontally
        drawH = box.h;
        drawW = box.h * imgRatio;
        drawX = box.x - (drawW - box.w) / 2;
        drawY = box.y;
      } else {
        // Image taller than box → match width, anchor to TOP (show head, crop body)
        drawW = box.w;
        drawH = box.w / imgRatio;
        drawX = box.x;
        drawY = box.y; // anchor top — keeps head visible
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } catch {
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
  }

  private paintFields(ctx: SKRSContext2D, s: SessionData): void {
    const { sx, sy, scaledFontSize } = this.canvasRenderer;
    ctx.textAlign = 'left';

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBoldSize)}px NotoSansEthiopic`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(s.nameAmharic ?? '', sx.call(this.canvasRenderer, FRONT.nameAmh.x), sy.call(this.canvasRenderer, FRONT.nameAmh.y));
    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBodySize)}px Roboto`;
    ctx.fillText(s.nameEnglish ?? '', sx.call(this.canvasRenderer, FRONT.nameEng.x), sy.call(this.canvasRenderer, FRONT.nameEng.y));

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBodySize)}px Roboto`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText([s.dobEthiopian, s.dobGregorian].filter(Boolean).join(' | '), sx.call(this.canvasRenderer, FRONT.dob.x), sy.call(this.canvasRenderer, FRONT.dob.y));

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBoldSize)}px NotoSansEthiopic`;
    ctx.fillStyle = '#1a1a1a';
    const sexAmh = s.sexAmharic ?? '';
    ctx.fillText(sexAmh, sx.call(this.canvasRenderer, FRONT.sex.x), sy.call(this.canvasRenderer, FRONT.sex.y));
    if (s.sexEnglish) {
      const amhW = ctx.measureText(sexAmh).width;
      ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBoldSize)}px Roboto`;
      ctx.fillText(` | ${s.sexEnglish}`, sx.call(this.canvasRenderer, FRONT.sex.x) + amhW, sy.call(this.canvasRenderer, FRONT.sex.y));
    }

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.frontBodySize)}px Roboto`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText([s.expiryEthiopian, s.expiryGregorian].filter(Boolean).join(' | '), sx.call(this.canvasRenderer, FRONT.expiry.x), sy.call(this.canvasRenderer, FRONT.expiry.y));

    if (s.issueEthiopian) {
      ctx.save();
      ctx.translate(sx.call(this.canvasRenderer, FRONT.issueEth.x), sy.call(this.canvasRenderer, FRONT.issueEth.y));
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, 22)}px Roboto`;
      ctx.fillText(s.issueEthiopian, 0, 0);
      ctx.restore();
    }

    if (s.issueGregorian) {
      ctx.save();
      ctx.translate(sx.call(this.canvasRenderer, FRONT.issueGreg.x), sy.call(this.canvasRenderer, FRONT.issueGreg.y));
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, 22)}px Roboto`;
      ctx.fillText(s.issueGregorian, 0, 0);
      ctx.restore();
    }
  }

  private async drawFcn(ctx: SKRSContext2D, fan: string): Promise<void> {
    if (!fan) return;
    const { sx, sy, scaledFontSize } = this.canvasRenderer;

    const bx = sx.call(this.canvasRenderer, FRONT.fcnBox.x);
    const by = sy.call(this.canvasRenderer, FRONT.fcnBox.y);
    const bw = sx.call(this.canvasRenderer, FRONT.fcnBox.w);
    const bh = sy.call(this.canvasRenderer, FRONT.fcnBox.h);
    const r  = 4;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.fcnSize)}px Roboto`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.fillText(fan, bx + bw / 2, by + Math.round(bh * 0.35));
    ctx.textAlign = 'left';

    try {
      const buf = await bwipjs.toBuffer({ bcid: 'code128', text: fan, scale: 2, height: 6, includetext: false });
      const img = await loadImage(buf);
      ctx.drawImage(img, bx + 4, by + Math.round(bh * 0.45), bw - 8, Math.round(bh * 0.5));
    } catch (err) {
      this.logger.warn(`Barcode failed: ${(err as Error).message}`);
    }
  }
}
