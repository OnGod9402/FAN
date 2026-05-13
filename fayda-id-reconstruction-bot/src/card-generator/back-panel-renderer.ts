import { Injectable, Logger } from '@nestjs/common';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { loadImage } from '@napi-rs/canvas';
import * as QRCode from 'qrcode';
import { SessionData } from '../session/session.types';
import { BACK, FONT } from './coords';
import { CanvasRenderer } from './canvas-renderer';
import { QrPayloadGenerator } from './qr-payload.generator';

@Injectable()
export class BackPanelRenderer {
  private readonly logger = new Logger(BackPanelRenderer.name);

  constructor(
    private readonly canvasRenderer: CanvasRenderer,
    private readonly qrPayload: QrPayloadGenerator,
  ) {}

  public async render(ctx: SKRSContext2D, session: SessionData, portrait?: Buffer, precomputedQr?: Buffer): Promise<void> {
    this.paintFields(ctx, session);
    await this.drawQr(ctx, session, portrait, precomputedQr);
  }

  /**
   * Pre-compute the QR code image buffer. Call this early (during review)
   * so it's ready by the time generateCombined() runs.
   */
  public async precomputeQr(session: SessionData, portrait?: Buffer): Promise<Buffer> {
    try {
      let qrBinaryData: Buffer;
      if (session.qrData) {
        qrBinaryData = this.parseStoredQrData(session.qrData);
      } else {
        qrBinaryData = await this.qrPayload.generate(session, portrait);
      }
      if (!qrBinaryData || qrBinaryData.length === 0) return Buffer.alloc(0);

      const size = Math.max(
        this.canvasRenderer.sx(BACK.qr.w),
        this.canvasRenderer.sy(BACK.qr.h),
      ) || 400;

      return await QRCode.toBuffer([{ data: qrBinaryData, mode: 'byte' }], {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'L',
      });
    } catch (err) {
      this.logger.warn(`QR precompute failed: ${(err as Error).message}`);
      return Buffer.alloc(0);
    }
  }

  private paintFields(ctx: SKRSContext2D, s: SessionData): void {
    const { sx, sy, scaledFontSize } = this.canvasRenderer;
    ctx.textAlign = 'left';

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize)}px Roboto`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(s.phone ?? '', sx.call(this.canvasRenderer, BACK.phone.x), sy.call(this.canvasRenderer, BACK.phone.y));

    ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize)}px NotoSansEthiopic`;
    ctx.fillStyle = '#1a1a1a';
    const natAmh = s.nationalityAmharic ?? '';
    ctx.fillText(natAmh, sx.call(this.canvasRenderer, BACK.nat.x), sy.call(this.canvasRenderer, BACK.nat.y));
    if (s.nationalityEnglish) {
      const natAmhW = ctx.measureText(natAmh).width;
      ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize)}px Roboto`;
      ctx.fillText(` | ${s.nationalityEnglish}`, sx.call(this.canvasRenderer, BACK.nat.x) + natAmhW, sy.call(this.canvasRenderer, BACK.nat.y));
    }

    const addrItems = [
      { amh: s.regionAmharic,  eng: s.regionEnglish  },
      { amh: s.zoneAmharic,    eng: s.zoneEnglish    },
      { amh: s.woredaAmharic,  eng: s.woredaEnglish  },
    ];
    let addrY = sy.call(this.canvasRenderer, BACK.addrStartY);
    const lineH = Math.round(scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize) * 1.3);
    for (const item of addrItems) {
      if (item.amh) {
        ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize)}px NotoSansEthiopic`;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(item.amh, sx.call(this.canvasRenderer, BACK.addrLabel.x), addrY);
        addrY += lineH;
      }
      if (item.eng) {
        ctx.font = `900 ${scaledFontSize.call(this.canvasRenderer, FONT.backBoldSize)}px Roboto`;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(item.eng, sx.call(this.canvasRenderer, BACK.addrLabel.x), addrY);
        addrY += lineH;
      }
    }

    if (s.fin) {
      ctx.fillStyle = '#1a1a1a';
      const finValue = s.fin.replace(/^FIN\s*/i, '');
      const bx = sx.call(this.canvasRenderer, BACK.finBox.x);
      const by = sy.call(this.canvasRenderer, BACK.finBox.y);
      const bw = sx.call(this.canvasRenderer, BACK.finBox.w);
      const bh = sy.call(this.canvasRenderer, BACK.finBox.h);

      // Auto-scale font to fit inside the finBox
      let fontSize = scaledFontSize.call(this.canvasRenderer, FONT.bodySize - 4);
      ctx.font = `900 ${fontSize}px Roboto`;
      while (ctx.measureText(finValue).width > bw * 0.90 && fontSize > 8) {
        fontSize--;
        ctx.font = `900 ${fontSize}px Roboto`;
      }

      ctx.textAlign = 'center';
      ctx.fillText(finValue, bx + bw / 2, by + bh - 6);
      ctx.textAlign = 'left';
    }

    ctx.font = `${scaledFontSize.call(this.canvasRenderer, FONT.smallSize)}px Roboto`;
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.fillText(
      'If lost and found, please return to nearby police station or to the institution. Call 9779 or visit id.et/cardprint for more.',
      sx.call(this.canvasRenderer, BACK.footer.x), sy.call(this.canvasRenderer, BACK.footer.y),
    );

    let snValue = s.sn;
    if (!snValue && s.fin) {
      let hash = 0;
      const finStr = s.fin.replace(/\D/g, '');
      for (let i = 0; i < finStr.length; i++) {
         hash = (hash << 5) - hash + finStr.charCodeAt(i);
         hash = hash & hash;
      }
      snValue = Math.abs(hash).toString().substring(0, 7).padStart(7, '0');
    }

    if (snValue) {
      // Draw the background box to mask the guilloche pattern
      const bx = sx.call(this.canvasRenderer, BACK.snBox.x);
      const by = sy.call(this.canvasRenderer, BACK.snBox.y);
      const bw = sx.call(this.canvasRenderer, BACK.snBox.w);
      const bh = sy.call(this.canvasRenderer, BACK.snBox.h);
      ctx.fillStyle = '#f8f9f6';
      ctx.fillRect(bx, by, bw, bh);

      // Draw a thin border around the box
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      // Draw the bold SN text centered in the box
      const fontSize = scaledFontSize.call(this.canvasRenderer, FONT.bodySize - 4);
      ctx.font = `900 ${fontSize}px Roboto`;
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      const textX = bx + bw / 2;     // horizontally centered
      const textY = by + bh * 0.65;  // vertically centered
      ctx.fillText(`SN: ${snValue}`, textX, textY);
    }
  }

  private async drawQr(ctx: SKRSContext2D, session: SessionData, portrait?: Buffer, precomputedQr?: Buffer): Promise<void> {
    const box = {
      x: this.canvasRenderer.sx(BACK.qr.x),
      y: this.canvasRenderer.sy(BACK.qr.y),
      w: this.canvasRenderer.sx(BACK.qr.w),
      h: this.canvasRenderer.sy(BACK.qr.h),
    };
    try {
      let buf: Buffer;

      if (precomputedQr && precomputedQr.length > 0) {
        // Use the pre-computed QR image — zero delay!
        buf = precomputedQr;
      } else {
        // Fallback: compute on the fly
        let qrBinaryData: Buffer;
        if (session.qrData) {
          qrBinaryData = this.parseStoredQrData(session.qrData);
        } else {
          qrBinaryData = await this.qrPayload.generate(session, portrait);
        }
        if (!qrBinaryData || qrBinaryData.length === 0) return;

        buf = await QRCode.toBuffer([{ data: qrBinaryData, mode: 'byte' }], {
          width: Math.max(box.w, box.h),
          margin: 1,
          errorCorrectionLevel: 'L',
        });
      }

      const img = await loadImage(buf);
      ctx.drawImage(img, box.x, box.y, box.w, box.h);
    } catch (err) {
      this.logger.warn(`QR failed: ${(err as Error).message}`);
    }
  }

  private parseStoredQrData(raw: string): Buffer {
    // New format stores base64 for exact binary preservation.
    try {
      const asBase64 = Buffer.from(raw, 'base64');
      if (asBase64.length > 0) return asBase64;
    } catch {
      // Ignore and fall back.
    }
    // Backward compatibility for older sessions that stored binary-as-string.
    return Buffer.from(raw, 'binary');
  }
}
