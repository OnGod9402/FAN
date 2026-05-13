import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConversationStep, SessionData } from './session.types';

import * as fs from 'fs';
import * as path from 'path';

interface SessionEntry {
  data: SessionData;
  timer: NodeJS.Timeout;
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly sessions = new Map<number, SessionEntry>();
  private readonly ttlMs: number;
  private readonly prefsPath = path.join(process.cwd(), 'user-prefs.json');
  private readonly langPrefs: Record<number, 'en' | 'am'> = {};
  private readonly themePrefs: Record<number, 'warm' | 'bright'> = {};

  constructor() {
    const ttlMinutes = parseInt(process.env.SESSION_TTL_MINUTES ?? '30', 10);
    this.ttlMs = ttlMinutes * 60 * 1000;
    
    try {
      if (fs.existsSync(this.prefsPath)) {
        const raw = JSON.parse(fs.readFileSync(this.prefsPath, 'utf8'));
        Object.assign(this.langPrefs, raw.langPrefs || {});
        Object.assign(this.themePrefs, raw.themePrefs || {});
      } else {
        // Migration from old lang-prefs.json to user-prefs.json
        const oldFile = path.join(process.cwd(), 'lang-prefs.json');
        if (fs.existsSync(oldFile)) {
           const oldRaw = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
           Object.assign(this.langPrefs, oldRaw || {});
           this.save();
        }
      }
    } catch {
      // Ignored
    }
  }

  private save() {
    fs.writeFileSync(this.prefsPath, JSON.stringify({ 
      langPrefs: this.langPrefs, 
      themePrefs: this.themePrefs 
    }));
  }

  getLangPref(userId: number): 'en' | 'am' | undefined {
    return this.langPrefs[userId];
  }

  saveLangPref(userId: number, lang: 'en' | 'am'): void {
    this.langPrefs[userId] = lang;
    this.save();
  }

  getThemePref(userId: number): 'warm' | 'bright' {
    return this.themePrefs[userId] ?? 'warm'; // Default is warm
  }

  saveThemePref(userId: number, theme: 'warm' | 'bright'): void {
    this.themePrefs[userId] = theme;
    this.save();
  }

  get(userId: number): SessionData | undefined {
    return this.sessions.get(userId)?.data;
  }

  set(userId: number, data: SessionData): void {
    this.clearTimer(userId);
    const timer = setTimeout(() => {
      this.sessions.delete(userId);
    }, this.ttlMs);
    this.sessions.set(userId, { data, timer });
  }

  delete(userId: number): void {
    this.clearTimer(userId);
    this.sessions.delete(userId);
  }

  merge(userId: number, partial: Partial<SessionData>): void {
    const existing = this.get(userId);
    const base: SessionData = existing ?? {
      step: ConversationStep.WELCOME,
      ocrAttempted: false,
      createdAt: new Date(),
    };
    this.set(userId, { ...base, ...partial });
  }

  activeCount(): number {
    return this.sessions.size;
  }

  onModuleDestroy(): void {
    for (const userId of this.sessions.keys()) {
      this.clearTimer(userId);
    }
    this.sessions.clear();
  }

  private clearTimer(userId: number): void {
    const entry = this.sessions.get(userId);
    if (entry) {
      clearTimeout(entry.timer);
    }
  }
}
