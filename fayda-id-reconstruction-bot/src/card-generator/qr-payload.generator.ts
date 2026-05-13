import { Injectable, Logger } from '@nestjs/common';
import { Encoder, addExtension } from 'cbor-x';
import * as crypto from 'crypto';
import { SessionData } from '../session/session.types';

class CoseSign1 {
  protected: Buffer;
  unprotected: Map<number, unknown> | Record<string, unknown>;
  payload: Buffer;
  signature: Buffer;

  constructor(
    protectedHeader: Buffer,
    unprotectedHeader: Map<number, unknown> | Record<string, unknown>,
    payload: Buffer,
    signature: Buffer,
  ) {
    this.protected = protectedHeader;
    this.unprotected = unprotectedHeader;
    this.payload = payload;
    this.signature = signature;
  }
}

const COSE_SIGN1_TAG = 18;

addExtension({
  Class: CoseSign1,
  tag: COSE_SIGN1_TAG,
  encode(instance: CoseSign1, encode: (value: unknown) => Buffer) {
    return encode([
      instance.protected,
      instance.unprotected,
      instance.payload,
      instance.signature,
    ]);
  },
  decode(data: unknown) {
    return data;
  },
});

const encoder = new Encoder({ tagUint8Array: false });

@Injectable()
export class QrPayloadGenerator {
  private readonly logger = new Logger(QrPayloadGenerator.name);

  async generate(session: SessionData, portraitBuffer?: Buffer): Promise<Buffer> {
    try {
      return await this.buildCosePayload(session, portraitBuffer);
    } catch (err) {
      this.logger.warn(`CBOR payload generation failed: ${(err as Error).message}`);
      return this.buildFallback(session);
    }
  }

  private async buildCosePayload(session: SessionData, portraitBuffer?: Buffer): Promise<Buffer> {
    const webpFace = await this.toCompressedWebp(portraitBuffer);
    const uuid = crypto.randomUUID();

    const fan = (session.fan ?? '').replace(/\D/g, '');
    const dob = this.formatDob(session.dobGregorian);

    // Format phone to international +251 format (e.g. "+251 900845403")
    let phone = (session.phone ?? '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('251')) phone = '251' + phone;
    phone = '+' + phone.replace(/^(\+?251)(\d{9})$/, '$1 $2');

    const name = session.nameEnglish ?? '';
    const eventDate = this.resolveEventDate(session);

    const protectedMap = new Map<number, unknown>();
    protectedMap.set(1, -7);
    const protectedHeader = Buffer.from(encoder.encode(protectedMap));

    const unprotectedHeader = new Map<number, unknown>();
    // Match working sample kid.
    unprotectedHeader.set(4, Buffer.from('qutPw5l_Vk6dWsw6xH37ZeDrR556IF0JNtQUJOpuHco', 'utf-8'));

    const payloadMap = new Map<number, unknown>();
    payloadMap.set(2, fan);
    payloadMap.set(4, eventDate);
    payloadMap.set(7, uuid);

    const profileMap = new Map<number, unknown>();
    profileMap.set(2, '1.0');
    // Match observed working key/value set
    profileMap.set(98, 9191880);
    profileMap.set(99, 'eFayda');
    profileMap.set(4, name);
    profileMap.set(8, dob);
    profileMap.set(9, 2);
    profileMap.set(12, phone);
    profileMap.set(13, 'ET');
    profileMap.set(62, [new Map(), webpFace]);
    payloadMap.set(169, profileMap);

    const payloadBytes = Buffer.from(encoder.encode(payloadMap));
    const signature = crypto.randomBytes(64);

    const cose = new CoseSign1(protectedHeader, unprotectedHeader, payloadBytes, signature);
    const result = Buffer.from(encoder.encode(cose));

    if (result.length > 2900) {
      this.logger.warn(`CBOR payload too large (${result.length} bytes), using fallback`);
      return this.buildFallback(session);
    }

    return result;
  }

  private async toCompressedWebp(portraitBuffer?: Buffer): Promise<Buffer> {
    if (!portraitBuffer || portraitBuffer.length === 0) {
      return crypto.randomBytes(400);
    }

    try {
      const sharp = (await import('sharp')).default;
      return await sharp(portraitBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Removes alpha transparency
        .resize(80, 100, { fit: 'cover' })
        .webp({ quality: 8 })
        .toBuffer();
    } catch {
      return crypto.randomBytes(400);
    }
  }

  private formatDob(dobGregorian?: string): string {
    if (!dobGregorian) return '';
    const cleaned = dobGregorian.replace(/[^0-9A-Za-z]/g, '');
    const match = cleaned.match(/^(\d{4})([A-Za-z]{3})(\d{2})$/);
    if (match) {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04',
        may: '05', jun: '06', jul: '07', aug: '08',
        sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const m = months[match[2].toLowerCase()] ?? '01';
      return `${match[1]}${m}${match[3]}`;
    }
    return cleaned.replace(/\D/g, '').slice(0, 8);
  }

  private resolveEventDate(session: SessionData): Date {
    // Working sample uses CBOR tag(1) date; keep same type in payload key 4.
    const raw = session.expiryGregorian ?? session.issueGregorian ?? session.dobGregorian;
    if (!raw) return new Date('2031-01-01T00:00:00.000Z');

    const m = raw.match(/^(\d{4})\/([A-Za-z]{3})\/(\d{2})$/);
    if (!m) return new Date('2031-01-01T00:00:00.000Z');
    const mon: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const month = mon[m[2].toLowerCase()];
    if (month === undefined) return new Date('2031-01-01T00:00:00.000Z');
    return new Date(Date.UTC(Number(m[1]), month, Number(m[3]), 0, 0, 0));
  }

  private buildFallback(session: SessionData): Buffer {
    const fin = (session.fin ?? '').replace(/^FIN\s*/i, '');
    const noise = crypto.randomBytes(800);
    return Buffer.concat([Buffer.from(`FIN:${fin}|`), noise]);
  }
}
