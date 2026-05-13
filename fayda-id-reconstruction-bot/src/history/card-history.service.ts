import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SessionData } from '../session/session.types';

type PersistedCardData = Partial<SessionData>;

export interface PersistedCardRecord {
  id: number;
  createdAt: string;
  updatedAt: string;
  imagePath: string;
  portraitPath?: string;
  data: PersistedCardData;
}

@Injectable()
export class CardHistoryService implements OnModuleInit {
  private readonly logger = new Logger(CardHistoryService.name);
  private queue: Buffer[] = [];
  private readonly MAX_CARDS = 5;
  private totalGenerated = 0;
  private readonly counterFile = path.join(process.cwd(), 'data', 'counter.json');
  private readonly cardsDir = path.join(process.cwd(), 'data', 'cards');

  onModuleInit() {
    try {
      if (fs.existsSync(this.counterFile)) {
        const raw = JSON.parse(fs.readFileSync(this.counterFile, 'utf8'));
        this.totalGenerated = raw.total ?? 0;
      }
    } catch {
      this.totalGenerated = 0;
    }
  }

  private persistCounter(): void {
    try {
      fs.mkdirSync(path.dirname(this.counterFile), { recursive: true });
      fs.writeFileSync(this.counterFile, JSON.stringify({ total: this.totalGenerated }));
    } catch (err) {
      this.logger.warn(`Failed to persist counter: ${(err as Error).message}`);
    }
  }

  private toPersistableData(session: SessionData): PersistedCardData {
    return {
      nameAmharic: session.nameAmharic,
      nameEnglish: session.nameEnglish,
      dobEthiopian: session.dobEthiopian,
      dobGregorian: session.dobGregorian,
      sexAmharic: session.sexAmharic,
      sexEnglish: session.sexEnglish,
      expiryEthiopian: session.expiryEthiopian,
      expiryGregorian: session.expiryGregorian,
      issueEthiopian: session.issueEthiopian,
      issueGregorian: session.issueGregorian,
      fan: session.fan,
      phone: session.phone,
      fin: session.fin,
      nationalityAmharic: session.nationalityAmharic,
      nationalityEnglish: session.nationalityEnglish,
      regionAmharic: session.regionAmharic,
      regionEnglish: session.regionEnglish,
      zoneAmharic: session.zoneAmharic,
      zoneEnglish: session.zoneEnglish,
      woredaAmharic: session.woredaAmharic,
      woredaEnglish: session.woredaEnglish,
      sn: session.sn,
      qrData: session.qrData,
      lang: session.lang,
      theme: session.theme,
    };
  }

  private cardPaths(cardId: number): { imagePath: string; portraitPath: string; recordPath: string } {
    return {
      imagePath: path.join(this.cardsDir, `card-${cardId}.png`),
      portraitPath: path.join(this.cardsDir, `portrait-${cardId}.png`),
      recordPath: path.join(this.cardsDir, `card-${cardId}.json`),
    };
  }

  saveCard(buffer: Buffer, session?: SessionData, portrait?: Buffer): number {
    if (this.queue.length >= this.MAX_CARDS) {
      this.queue.shift();
    }
    this.queue.push(buffer);
    this.totalGenerated++;
    this.persistCounter();

    try {
      fs.mkdirSync(this.cardsDir, { recursive: true });
      const cardId = this.totalGenerated;
      const paths = this.cardPaths(cardId);
      fs.writeFileSync(paths.imagePath, buffer);

      let portraitPath: string | undefined;
      if (portrait && portrait.length > 0) {
        fs.writeFileSync(paths.portraitPath, portrait);
        portraitPath = paths.portraitPath;
      }

      const now = new Date().toISOString();
      const record: PersistedCardRecord = {
        id: cardId,
        createdAt: now,
        updatedAt: now,
        imagePath: paths.imagePath,
        portraitPath,
        data: session ? this.toPersistableData(session) : {},
      };
      fs.writeFileSync(paths.recordPath, JSON.stringify(record, null, 2));
    } catch (err) {
      this.logger.warn(`Failed to persist card file(s): ${(err as Error).message}`);
    }

    this.logger.log(`Card #${this.totalGenerated} saved. Queue: ${this.queue.length}`);
    return this.totalGenerated;
  }

  getCardRecord(cardId: number): PersistedCardRecord | null {
    try {
      const { recordPath } = this.cardPaths(cardId);
      if (!fs.existsSync(recordPath)) return null;
      const raw = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as PersistedCardRecord;
      return raw;
    } catch (err) {
      this.logger.warn(`Failed to read card record #${cardId}: ${(err as Error).message}`);
      return null;
    }
  }

  getCardPortrait(cardId: number): Buffer | null {
    try {
      const record = this.getCardRecord(cardId);
      if (!record?.portraitPath || !fs.existsSync(record.portraitPath)) return null;
      return fs.readFileSync(record.portraitPath);
    } catch (err) {
      this.logger.warn(`Failed to read portrait #${cardId}: ${(err as Error).message}`);
      return null;
    }
  }

  updateCard(cardId: number, newImage: Buffer, session: SessionData): boolean {
    try {
      const record = this.getCardRecord(cardId);
      if (!record) return false;

      fs.mkdirSync(this.cardsDir, { recursive: true });
      fs.writeFileSync(record.imagePath, newImage);

      const nextRecord: PersistedCardRecord = {
        ...record,
        updatedAt: new Date().toISOString(),
        data: this.toPersistableData(session),
      };
      const { recordPath } = this.cardPaths(cardId);
      fs.writeFileSync(recordPath, JSON.stringify(nextRecord, null, 2));
      return true;
    } catch (err) {
      this.logger.warn(`Failed to update card #${cardId}: ${(err as Error).message}`);
      return false;
    }
  }

  getTotalGenerated(): number {
    return this.totalGenerated;
  }

  resetCounter(): void {
    this.totalGenerated = 0;
    this.persistCounter();
  }

  getLastCards(): Buffer[] {
    return this.queue;
  }

  clearQueue(): void {
    this.queue = [];
  }
}
