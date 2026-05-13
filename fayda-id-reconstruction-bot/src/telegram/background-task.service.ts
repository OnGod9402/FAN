import { Injectable } from '@nestjs/common';
import { SessionData } from '../session/session.types';

interface UserTasks {
  frontOcr?: Promise<Partial<SessionData>>;
  backOcr?: Promise<Partial<SessionData>>;
  qrData?: Promise<string | null>;
  portrait?: Promise<Buffer>;
  qrImage?: Promise<Buffer>;
  classifications?: Promise<{ type: string, rawText: string, processedBuffer: Buffer, origBuffer: Buffer }>[];
}

@Injectable()
export class BackgroundTaskService {
  private readonly tasks = new Map<number, UserTasks>();

  get(userId: number): UserTasks {
    if (!this.tasks.has(userId)) this.tasks.set(userId, {});
    return this.tasks.get(userId)!;
  }

  clear(userId: number): void {
    this.tasks.delete(userId);
  }
}
