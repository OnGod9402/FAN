import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class BackgroundRemover {
  private readonly logger = new Logger(BackgroundRemover.name);
  private readonly debugDir = process.env.PHOTO_DEBUG_DIR;
  private removeBackgroundFn: ((blob: Blob) => Promise<Blob>) | null = null;
  private loadPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.removeBackgroundFn) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const mod = await import('@imgly/background-removal-node');
          this.removeBackgroundFn = mod.removeBackground ?? (mod as any).default?.removeBackground;
          this.logger.log('AI background removal model loaded');
        } catch (err) {
          this.logger.warn(`Failed to load AI BG removal: ${(err as Error).message}. Using fallback.`);
        }
      })();
    }
    await this.loadPromise;
  }

  async removeBackground(portraitBuffer: Buffer): Promise<Buffer> {
    try {
      await this.ensureLoaded();

      if (this.removeBackgroundFn) {
        return await this.aiRemoveBackground(portraitBuffer);
      }

      // Fallback: simple color-based removal
      return await this.fallbackRemoveBackground(portraitBuffer);
    } catch (err) {
      this.logger.warn(`Background removal failed: ${(err as Error).message}`);
      return portraitBuffer;
    }
  }

  private async aiRemoveBackground(portraitBuffer: Buffer): Promise<Buffer> {
    const pngBuffer = await sharp(portraitBuffer).png().toBuffer();
    const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' });

    const resultBlob = await this.removeBackgroundFn!(blob);
    const arrayBuffer = await resultBlob.arrayBuffer();
    const result = Buffer.from(arrayBuffer);

    // Safety check: make sure the AI didn't remove too much
    const { data, info } = await sharp(result)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const total = info.width * info.height;
    let opaque = 0;
    for (let i = 0; i < total; i++) {
      if (pixels[i * 4 + 3] > 120) opaque++;
    }
    const opaqueRatio = opaque / total;

    this.logger.debug(`AI BG removal: opaque=${(opaqueRatio * 100).toFixed(1)}%`);

    if (opaqueRatio < 0.15 || opaqueRatio > 0.98) {
      this.logger.warn(`AI BG removal unsafe (opaque=${(opaqueRatio * 100).toFixed(1)}%), keeping original`);
      return portraitBuffer;
    }

    await this.writeDebug(portraitBuffer, result, `ai-${Date.now()}`);
    return result;
  }

  private async fallbackRemoveBackground(portraitBuffer: Buffer): Promise<Buffer> {
    // Simple color-distance flood-fill from borders
    const { data, info } = await sharp(portraitBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    const pixels = new Uint8Array(data);

    // Sample border pixels to get average background color
    const border = Math.max(2, Math.round(Math.min(width, height) * 0.06));
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x < border || x >= width - border || y < border || y >= height - border) {
          const idx = (y * width + x) * channels;
          sumR += pixels[idx];
          sumG += pixels[idx + 1];
          sumB += pixels[idx + 2];
          count++;
        }
      }
    }

    const avgR = sumR / count, avgG = sumG / count, avgB = sumB / count;
    const avgLuma = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;

    // Only attempt removal if background looks bright enough
    if (avgLuma < 140) {
      this.logger.debug('Fallback BG: too dark, skipping removal');
      return portraitBuffer;
    }

    // Flood-fill from edges
    const isBackground = new Uint8Array(width * height);
    const queue: number[] = [];
    for (let x = 0; x < width; x++) {
      queue.push(x, (height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      queue.push(y * width, y * width + width - 1);
    }

    while (queue.length > 0) {
      const idx = queue.pop()!;
      if (idx < 0 || idx >= width * height || isBackground[idx]) continue;
      const px = idx * channels;
      const r = pixels[px], g = pixels[px + 1], b = pixels[px + 2];
      const dist = Math.sqrt((r - avgR) ** 2 + (g - avgG) ** 2 + (b - avgB) ** 2);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (dist > 80 || luma < 140) continue;
      isBackground[idx] = 1;
      queue.push(idx - 1, idx + 1, idx - width, idx + width);
    }

    let removed = 0;
    for (let i = 0; i < width * height; i++) {
      if (isBackground[i]) {
        pixels[i * channels + 3] = 0;
        removed++;
      }
    }

    const removedRatio = removed / (width * height);
    this.logger.debug(`Fallback BG removal: removed=${(removedRatio * 100).toFixed(1)}%`);

    if (removedRatio < 0.04 || removedRatio > 0.82) {
      return portraitBuffer;
    }

    const output = await sharp(Buffer.from(pixels), {
      raw: { width, height, channels },
    }).png().toBuffer();

    await this.writeDebug(portraitBuffer, output, `fallback-${Date.now()}`);
    return output;
  }

  private async writeDebug(input: Buffer, output: Buffer, suffix: string): Promise<void> {
    if (!this.debugDir) return;
    try {
      await fs.mkdir(this.debugDir, { recursive: true });
      await fs.writeFile(path.join(this.debugDir, `bg-input-${suffix}.png`), input);
      await fs.writeFile(path.join(this.debugDir, `bg-final-${suffix}.png`), output);
    } catch (err) {
      this.logger.debug(`Skipping debug write: ${(err as Error).message}`);
    }
  }
}
