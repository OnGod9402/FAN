import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { LocalFaceService } from './local-face.service';
import { BackgroundRemover } from './background-remover';
import { buildPortraitCrop, CropRect, DetectedFace, selectBestFace, translateFace } from './portrait-framing';

const PORTRAIT_W = parseInt(process.env.FRONT_PORTRAIT_W ?? '285', 10);
const PORTRAIT_H = parseInt(process.env.FRONT_PORTRAIT_H ?? '420', 10);

const CARD_REGION = {
  leftRatio: 0.05,
  topRatio: 0.22,
  rightRatio: 0.95,
  bottomRatio: 0.82,
};

const FACE_IN_CARD = {
  leftRatio: 0.03,
  topRatio: 0.15,
  rightRatio: 0.35,
  bottomRatio: 0.85,
};

const PORTRAIT_SEARCH_IN_CARD = {
  leftRatio: 0.05,
  topRatio: 0.08,
  rightRatio: 0.45,
  bottomRatio: 0.72,
};

@Injectable()
export class PhotoProcessorService {
  private readonly logger = new Logger(PhotoProcessorService.name);
  private readonly debugDir = process.env.PHOTO_DEBUG_DIR;

  constructor(
    private readonly localFaceService: LocalFaceService,
    private readonly backgroundRemover: BackgroundRemover,
  ) { }

  async removeBackground(portraitBuffer: Buffer): Promise<Buffer> {
    return this.backgroundRemover.removeBackground(portraitBuffer);
  }

  async processPortrait(screenshotBuffer: Buffer): Promise<Buffer> {
    try {
      const baseColor = await sharp(screenshotBuffer)
        .rotate()
        .resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();

      const preparedForDetection = await sharp(baseColor)
        .normalise()
        .sharpen()
        .png()
        .toBuffer();

      const meta = await sharp(baseColor).metadata();
      const W = meta.width ?? 1080;
      const H = meta.height ?? 1920;
      await this.writeDebug('01-screenshot.png', baseColor);

      let face: DetectedFace | null = null;

      // Local face-api.js detection (scan the ENTIRE image once, then rank by expected ROI)
      if (this.localFaceService.isConfigured()) {
        try {
          const cardRegion = this.getCardRegion(W, H);
          const cardPortraitSearch = this.getPortraitSearchRegion(cardRegion.width, cardRegion.height);
          const cardPortraitRoi: CropRect = {
            left: cardRegion.left + cardPortraitSearch.left,
            top: cardRegion.top + cardPortraitSearch.top,
            width: cardPortraitSearch.width,
            height: cardPortraitSearch.height,
          };
          const popupPortraitRoi: CropRect = {
            left: Math.round(W * 0.2),
            top: Math.round(H * 0.12),
            width: Math.round(W * 0.6),
            height: Math.round(H * 0.52),
          };
          const preferredRoi = H > W * 1.5 ? popupPortraitRoi : cardPortraitRoi;

          const roiBuffer = await sharp(preparedForDetection)
            .extract(preferredRoi)
            .png()
            .toBuffer();
          const roiFaces = (await this.localFaceService.detectFaces(roiBuffer))
            .map((f) => translateFace(f, preferredRoi.left, preferredRoi.top));

          const fullFaces = await this.localFaceService.detectFaces(preparedForDetection);
          const localFaces = [...roiFaces, ...fullFaces];

          face = selectBestFace(localFaces, W, H, { preferredRoi, minAreaRatio: 0.01 });
          if (!face) {
            face = selectBestFace(localFaces, W, H, { preferredRoi, minAreaRatio: 0.004 });
          }
          if (face) this.logger.log('Face detected using local face-api.js on full image');
        } catch (err) {
          this.logger.warn(`Local face detection failed: ${(err as Error).message}`);
        }
      }

      if (face) {
        const cropRect = buildPortraitCrop(face, W, H, PORTRAIT_W, PORTRAIT_H);
        return this.renderPortrait(baseColor, cropRect, '03-vision-portrait.png');
      }

      // Fallback if no face was found
      
      // If it's a tall mobile screenshot (like the digital ID popup), guess top-center
      if (H > W * 1.5) {
        const faceWidth = Math.round(W * 0.45);
        const faceHeight = Math.round(H * 0.35);
        const faceLeft = Math.round((W - faceWidth) / 2);
        const faceTop = Math.round(H * 0.1);
        
        this.logger.debug(`Popup heuristic region: ${faceWidth}x${faceHeight} at (${faceLeft},${faceTop})`);
        
        const portrait = await sharp(baseColor)
          .extract({ left: faceLeft, top: faceTop, width: faceWidth, height: faceHeight })
          .resize(PORTRAIT_W, PORTRAIT_H, { fit: 'cover', position: 'north' })
          .png()
          .toBuffer();
        
        await this.writeDebug('03-heuristic-popup-portrait.png', portrait);
        return portrait;
      }

      // Standard ID card horizontal layout heuristic
      const { left: cardLeft, top: cardTop, width: cardWidth, height: cardHeight } = this.getCardRegion(W, H);

      const cardBuffer = await sharp(baseColor)
        .extract({ left: cardLeft, top: cardTop, width: cardWidth, height: cardHeight })
        .toBuffer();

      const faceLeft = Math.round(cardWidth * FACE_IN_CARD.leftRatio);
      const faceTop = Math.round(cardHeight * FACE_IN_CARD.topRatio);
      const faceWidth = Math.round(cardWidth * (FACE_IN_CARD.rightRatio - FACE_IN_CARD.leftRatio));
      const faceHeight = Math.round(cardHeight * (FACE_IN_CARD.bottomRatio - FACE_IN_CARD.topRatio));

      this.logger.debug(`Card region: ${cardWidth}x${cardHeight} at (${cardLeft},${cardTop})`);
      this.logger.debug(`Face region: ${faceWidth}x${faceHeight} at (${faceLeft},${faceTop})`);

      const portrait = await sharp(cardBuffer)
        .extract({ left: faceLeft, top: faceTop, width: faceWidth, height: faceHeight })
        .resize(PORTRAIT_W, PORTRAIT_H, { fit: 'cover', position: 'north' })
        .png()
        .toBuffer();

      await this.writeDebug('03-heuristic-portrait.png', portrait);
      return portrait;
    } catch (err) {
      this.logger.error(`Portrait extraction failed: ${(err as Error).message}`);
      return sharp(screenshotBuffer)
        .resize(
          parseInt(process.env.FRONT_PORTRAIT_W ?? '288', 10),
          parseInt(process.env.FRONT_PORTRAIT_H ?? '420', 10),
          { fit: 'cover', position: 'north' },
        )
        .png()
        .toBuffer();
    }
  }

  private getCardRegion(width: number, height: number): CropRect {
    return {
      left: Math.round(width * CARD_REGION.leftRatio),
      top: Math.round(height * CARD_REGION.topRatio),
      width: Math.round(width * (CARD_REGION.rightRatio - CARD_REGION.leftRatio)),
      height: Math.round(height * (CARD_REGION.bottomRatio - CARD_REGION.topRatio)),
    };
  }

  private getPortraitSearchRegion(width: number, height: number): CropRect {
    return {
      left: Math.round(width * PORTRAIT_SEARCH_IN_CARD.leftRatio),
      top: Math.round(height * PORTRAIT_SEARCH_IN_CARD.topRatio),
      width: Math.round(width * (PORTRAIT_SEARCH_IN_CARD.rightRatio - PORTRAIT_SEARCH_IN_CARD.leftRatio)),
      height: Math.round(height * (PORTRAIT_SEARCH_IN_CARD.bottomRatio - PORTRAIT_SEARCH_IN_CARD.topRatio)),
    };
  }

  private async renderPortrait(imageBuffer: Buffer, cropRect: CropRect, debugName: string): Promise<Buffer> {
    const w = parseInt(process.env.FRONT_PORTRAIT_W ?? '288', 10);
    const h = parseInt(process.env.FRONT_PORTRAIT_H ?? '420', 10);
    const portrait = await sharp(imageBuffer)
      .extract(cropRect)
      .resize(w, h, { fit: 'cover', position: 'north' })
      .png()
      .toBuffer();

    await this.writeDebug(debugName, portrait);
    return portrait;
  }

  private async writeDebug(filename: string, buffer: Buffer): Promise<void> {
    if (!this.debugDir) return;

    try {
      await fs.mkdir(this.debugDir, { recursive: true });
      await fs.writeFile(path.join(this.debugDir, filename), buffer);
    } catch (err) {
      this.logger.debug(`Skipping debug image write: ${(err as Error).message}`);
    }
  }
}
