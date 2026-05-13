import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import jsQR from 'jsqr';
import * as os from 'os';

import { SessionData } from '../session/session.types';
import { FrontCardParser } from './front-card-parser';
import { BackCardParser } from './back-card-parser';
import { ImageClassifier, ImageType } from './image-classifier';

@Injectable()
export class OcrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private scheduler: Tesseract.Scheduler | null = null;

  constructor(
    private readonly frontParser: FrontCardParser,
    private readonly backParser: BackCardParser,
    private readonly classifier: ImageClassifier,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.scheduler = Tesseract.createScheduler();
      const cpuCount = Math.max(2, os.cpus().length);
      const configured = parseInt(process.env.OCR_WORKERS ?? '', 10);
      const numWorkers = Number.isFinite(configured) && configured > 0
        ? configured
        : Math.min(8, Math.max(4, Math.floor(cpuCount * 0.75)));
      for (let i = 0; i < numWorkers; i++) {
        const worker = await Tesseract.createWorker(['amh', 'eng']);
        this.scheduler.addWorker(worker);
      }
      this.logger.log(`Tesseract scheduler initialised with ${numWorkers} workers (amh+eng)`);
    } catch (err) {
      this.logger.warn(`Tesseract scheduler failed to initialise: ${(err as Error).message}`);
      this.scheduler = null;
    }
  }

  async quickClassify(imageBuffer: Buffer): Promise<{ type: ImageType; rawText: string; processedBuffer: Buffer }> {
    if (!this.scheduler) {
      this.logger.warn('OCR scheduler not available');
      return { type: 'portrait', rawText: '', processedBuffer: imageBuffer };
    }

    try {
      const processedBuffer = await this.preprocessForOcr(imageBuffer);
      const rawText = await this.recognize(processedBuffer);
      const type = this.classifier.classify(rawText);
      return { type, rawText, processedBuffer };
    } catch (err) {
      this.logger.warn(`Classification failed: ${(err as Error).message}`);
      return { type: 'portrait', rawText: '', processedBuffer: imageBuffer };
    }
  }

  async extractBackQrImage(imageBuffer: Buffer): Promise<Buffer | null> {
    try {
      const rotated = await sharp(imageBuffer).rotate().png().toBuffer();
      const meta = await sharp(rotated).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width <= 0 || height <= 0) return null;

      const cardLeft = Math.round(width * 0.05);
      const cardTop = Math.round(height * 0.22);
      const cardWidth = Math.round(width * 0.90);
      const cardHeight = Math.round(height * 0.60);

      const qrLeft = cardLeft + Math.round(cardWidth * 0.56);
      const qrTop = cardTop + Math.round(cardHeight * 0.06);
      const qrWidth = Math.round(cardWidth * 0.42);
      const qrHeight = Math.round(cardHeight * 0.58);

      const safeLeft = Math.max(0, Math.min(width - 1, qrLeft));
      const safeTop = Math.max(0, Math.min(height - 1, qrTop));
      const safeWidth = Math.max(1, Math.min(width - safeLeft, qrWidth));
      const safeHeight = Math.max(1, Math.min(height - safeTop, qrHeight));

      return sharp(rotated)
        .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
        .normalise()
        .sharpen()
        .png()
        .toBuffer();
    } catch (err) {
      this.logger.warn(`Back QR extraction failed: ${(err as Error).message}`);
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
    }
  }

  async extractFrontCard(processedBuffer: Buffer, rawText: string): Promise<Partial<SessionData>> {
    try {
      this.logger.debug(`=== FRONT OCR MAIN ===\n${rawText}\n=== END FRONT OCR MAIN ===`);
      
      let verticalText = '';
      if (this.scheduler) {
        const rightEdge = await this.extractFrontRightEdge(processedBuffer);
        verticalText = await this.recognize(rightEdge);
        this.logger.debug(`=== FRONT OCR VERTICAL ===\n${verticalText}\n=== END FRONT OCR VERTICAL ===`);
      }

      let fields = this.frontParser.parse(rawText, verticalText);

      if (this.hasMissingFrontFields(fields)) {
        const variants = await this.buildOcrVariants(processedBuffer);
        for (const variant of variants) {
          const altText = await this.recognize(variant);
          const altEdge = await this.extractFrontRightEdge(variant);
          const altVertical = await this.recognize(altEdge);
          const altFields = this.frontParser.parse(altText, altVertical);
          fields = this.mergeMissingFields(fields, altFields);
          if (!this.hasMissingFrontFields(fields)) break;
        }
      }

      if (!fields.fan) {
        const fanBand = await this.extractFrontFanBand(processedBuffer);
        const fanBandRaw = await this.recognize(fanBand);
        const fanOnly = this.frontParser.parse(fanBandRaw);
        fields = { ...fields, fan: fields.fan ?? fanOnly.fan };
      }

      this.logger.log(`Front extracted: ${JSON.stringify(fields)}`);
      return fields;
    } catch (err) {
      this.logger.warn(`Front OCR extraction failed: ${(err as Error).message}`);
      return {};
    }
  }

  async decodeQrData(imageBuffer: Buffer): Promise<string | null> {
    try {
      const candidates: Buffer[] = [imageBuffer];
      const cropped = await this.extractBackQrImage(imageBuffer);
      if (cropped) candidates.push(cropped);

      for (const candidate of candidates) {
        const encoded = await this.decodeQrBase64(candidate);
        if (encoded) return encoded;
      }

      // Non-fatal: renderer can still use extractedQrBuffer directly.
      this.logger.debug('jsQR could not decode QR payload bytes from candidates');
      return null;
    } catch (err) {
      // Keep this non-blocking; decode is optional now.
      this.logger.debug(`QR payload decode skipped: ${(err as Error).message}`);
      return null;
    }
  }

  private async decodeQrBase64(imageBuffer: Buffer): Promise<string | null> {
    const variants: Buffer[] = [];
    variants.push(imageBuffer);

    variants.push(await sharp(imageBuffer).greyscale().png().toBuffer());
    variants.push(await sharp(imageBuffer).greyscale().normalise().sharpen().png().toBuffer());
    variants.push(await sharp(imageBuffer).greyscale().threshold(180).png().toBuffer());
    variants.push(await sharp(imageBuffer).greyscale().threshold(140).png().toBuffer());
    variants.push(await sharp(imageBuffer).resize({ width: 1400, withoutEnlargement: false }).png().toBuffer());
    variants.push(
      await sharp(imageBuffer)
        .greyscale()
        .threshold(170)
        .resize({ width: 1400, withoutEnlargement: false })
        .png()
        .toBuffer(),
    );

    for (const variant of variants) {
      const { data, info } = await sharp(variant)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (!qr) continue;

      const raw = qr.binaryData ? Buffer.from(qr.binaryData) : Buffer.from(qr.data, 'binary');
      if (!raw.length) continue;
      this.logger.log(`Decoded binary QR payload (${raw.length} bytes)`);
      return raw.toString('base64');
    }

    return null;
  }

  async extractBackCard(processedBuffer: Buffer, rawText: string): Promise<Partial<SessionData>> {
    if (!this.scheduler) {
      this.logger.warn('OCR scheduler not available');
      return {};
    }

    try {
      let fields = this.backParser.parse(rawText);
      this.logger.debug(`=== BACK OCR FULL (first pass) ===\n${rawText}\n=== END BACK OCR FULL ===`);

      if (!fields.fin || !fields.phone) {
        this.logger.log('Missing FIN or Phone in full OCR. Trying region OCR...');
        const region = await this.extractBackTextRegion(processedBuffer);
        const regionRaw = await this.recognize(region);
        this.logger.debug(`=== BACK OCR REGION ===\n${regionRaw}\n=== END BACK OCR REGION ===`);
        const regionFields = this.backParser.parse(regionRaw);
        fields = {
          ...fields,
          ...regionFields,
          // Keep first-pass high-confidence values if they already exist.
          fin: fields.fin ?? regionFields.fin,
          phone: fields.phone ?? regionFields.phone,
        };
      }

      if (this.hasMissingBackFields(fields)) {
        const variants = await this.buildOcrVariants(processedBuffer);
        for (const variant of variants) {
          const altRaw = await this.recognize(variant);
          const altFields = this.backParser.parse(altRaw);
          fields = this.mergeMissingFields(fields, altFields);

          if (this.hasMissingBackFields(fields)) {
            const altRegion = await this.extractBackTextRegion(variant);
            const altRegionRaw = await this.recognize(altRegion);
            const altRegionFields = this.backParser.parse(altRegionRaw);
            fields = this.mergeMissingFields(fields, altRegionFields);
          }

          if (!this.hasMissingBackFields(fields)) break;
        }
      }

      this.logger.log(`Back extracted: ${JSON.stringify(fields)}`);
      return fields;
    } catch (err) {
      this.logger.warn(`Back OCR extraction failed: ${(err as Error).message}`);
      return {};
    }
  }

  async extractFields(imageBuffer: Buffer): Promise<Partial<SessionData>> {
    const { rawText, processedBuffer } = await this.quickClassify(imageBuffer);
    const front = await this.extractFrontCard(processedBuffer, rawText);
    const back = await this.extractBackCard(processedBuffer, rawText);
    return { ...back, ...front };
  }

  private async preprocessForOcr(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: false })
      .normalise()
      .sharpen()
      .png()
      .toBuffer();
  }

  private async buildOcrVariants(imageBuffer: Buffer): Promise<Buffer[]> {
    const variants: Buffer[] = [];
    variants.push(await sharp(imageBuffer).greyscale().normalise().sharpen().png().toBuffer());
    variants.push(await sharp(imageBuffer).greyscale().threshold(165).png().toBuffer());
    variants.push(
      await sharp(imageBuffer)
        .normalise()
        .sharpen({ sigma: 1.6 })
        .resize({ width: 2600, withoutEnlargement: false })
        .png()
        .toBuffer(),
    );
    return variants;
  }

  private hasMissingFrontFields(fields: Partial<SessionData>): boolean {
    return !fields.nameEnglish || !fields.dobGregorian || !fields.sexEnglish || !fields.fan;
  }

  private hasMissingBackFields(fields: Partial<SessionData>): boolean {
    return !fields.fin || !fields.phone || !fields.nationalityEnglish || !fields.regionEnglish;
  }

  private mergeMissingFields(
    primary: Partial<SessionData>,
    candidate: Partial<SessionData>,
  ): Partial<SessionData> {
    const merged: Partial<SessionData> = { ...primary };
    for (const [key, value] of Object.entries(candidate) as Array<[keyof SessionData, unknown]>) {
      if (value === undefined || value === null || value === '') continue;
      if (!merged[key]) {
        merged[key] = value as never;
      }
    }
    return merged;
  }

  private async extractFrontRightEdge(imageBuffer: Buffer): Promise<Buffer> {
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) {
      return imageBuffer;
    }

    // Crop the right 20% of the image where the vertical dates are located
    const left = Math.max(0, Math.min(width - 1, Math.round(width * 0.80)));
    const regionWidth = Math.max(1, Math.min(width - left, Math.round(width * 0.20)));

    return sharp(imageBuffer)
      .extract({ left, top: 0, width: regionWidth, height })
      .rotate(90) // Rotate 90 degrees clockwise to make bottom-to-top text read left-to-right
      .normalise()
      .sharpen()
      .png()
      .toBuffer();
  }

  private async extractFrontFanBand(imageBuffer: Buffer): Promise<Buffer> {
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) {
      return imageBuffer;
    }

    const left = Math.max(0, Math.min(width - 1, Math.round(width * 0.08)));
    const top = Math.max(0, Math.min(height - 1, Math.round(height * 0.62)));
    const bandWidth = Math.max(1, Math.min(width - left, Math.round(width * 0.84)));
    const bandHeight = Math.max(1, Math.min(height - top, Math.round(height * 0.28)));

    return sharp(imageBuffer)
      .extract({ left, top, width: bandWidth, height: bandHeight })
      .greyscale()
      .normalise()
      .sharpen()
      .resize({ width: 1800, withoutEnlargement: false })
      .png()
      .toBuffer();
  }

  private async extractBackTextRegion(imageBuffer: Buffer): Promise<Buffer> {
    const meta = await sharp(imageBuffer).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 0 || height <= 0) {
      return imageBuffer;
    }

    const left = Math.max(0, Math.min(width - 1, Math.round(width * 0.05)));
    const top = Math.max(0, Math.min(height - 1, Math.round(height * 0.40)));
    const regionWidth = Math.max(1, Math.min(width - left, Math.round(width * 0.90)));
    const regionHeight = Math.max(1, Math.min(height - top, Math.round(height * 0.55)));

    return sharp(imageBuffer)
      .extract({ left, top, width: regionWidth, height: regionHeight })
      .normalise()
      .sharpen()
      .png()
      .toBuffer();
  }

  private async recognize(imageBuffer: Buffer): Promise<string> {
    if (!this.scheduler) {
      return '';
    }
    const { data } = await this.scheduler.addJob('recognize', imageBuffer);
    return data.text ?? '';
  }
}
