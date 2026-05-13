import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import * as path from 'path';
import * as fs from 'fs';
import { SessionData } from '../session/session.types';
import { COMBINED_W, COMBINED_H, PANEL_W } from './coords';
import { FrontPanelRenderer } from './front-panel-renderer';
import { BackPanelRenderer } from './back-panel-renderer';

const ASSETS = path.join(process.cwd(), 'assets');
const FONTS  = path.join(ASSETS, 'fonts');

@Injectable()
export class CardGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(CardGeneratorService.name);

  constructor(
    private readonly frontRenderer: FrontPanelRenderer,
    private readonly backRenderer: BackPanelRenderer,
  ) {}

  onModuleInit(): void {
    this.registerFonts();
  }

  private registerFonts(): void {
    const allow =
      process.env.NODE_ENV === 'test' ||
      process.env.ALLOW_MISSING_ETHIOPIC_FONTS === 'true';

    const fonts = [
      { file: 'NotoSansEthiopic-VariableFont_wdth,wght.ttf', family: 'NotoSansEthiopic' },
      { file: 'Roboto-VariableFont_wdth,wght.ttf',           family: 'Roboto' },
    ];

    const missing: string[] = [];
    for (const f of fonts) {
      const fp = path.join(FONTS, f.file);
      if (fs.existsSync(fp)) {
        GlobalFonts.registerFromPath(fp, f.family);
        this.logger.log(`Font loaded: ${f.file}`);
      } else {
        missing.push(f.file);
      }
    }

    if (missing.length > 0 && !allow) {
      throw new Error(`Missing required font files in assets/fonts: ${missing.join(', ')}`);
    }
  }

  async generateCombined(session: SessionData, portrait: Buffer, precomputedQr?: Buffer): Promise<Buffer> {
    const canvas = createCanvas(COMBINED_W, COMBINED_H);
    const ctx    = canvas.getContext('2d');

    const templateFileName = session.theme === 'bright' ? 'bg_combined.png' : 'bg_combined2.png';
    await this.drawTemplate(ctx, templateFileName, COMBINED_W, COMBINED_H);

    await this.frontRenderer.render(ctx, session, portrait);

    ctx.save();
    ctx.translate(PANEL_W, 0);
    await this.backRenderer.render(ctx, session, portrait, precomputedQr);
    ctx.restore();

    return canvas.toBuffer('image/png');
  }

  async precomputeQr(session: SessionData, portrait?: Buffer): Promise<Buffer> {
    return this.backRenderer.precomputeQr(session, portrait);
  }

  private async drawTemplate(ctx: SKRSContext2D, file: string, w: number, h: number): Promise<void> {
    const p = path.join(ASSETS, file);
    if (fs.existsSync(p)) {
      ctx.drawImage(await loadImage(p), 0, 0, w, h);
    } else {
      ctx.fillStyle = '#e8f5e9';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#999';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[${file} not found]`, w / 2, h / 2);
      ctx.textAlign = 'left';
    }
  }
}
