import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { ConversationStep, SessionData } from './session.types';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    step: ConversationStep.WELCOME,
    ocrAttempted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService],
    }).compile();
    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('get', () => {
    it('returns undefined for unknown user', () => {
      expect(service.get(1)).toBeUndefined();
    });

    it('returns stored session data', () => {
      const data = makeSession({ nameEnglish: 'Abebe' });
      service.set(1, data);
      expect(service.get(1)).toEqual(data);
    });
  });

  describe('set', () => {
    it('stores session and allows retrieval', () => {
      const data = makeSession({ fan: '1234567890123456' });
      service.set(42, data);
      expect(service.get(42)).toEqual(data);
    });

    it('overwrites existing session', () => {
      service.set(1, makeSession({ nameEnglish: 'First' }));
      const updated = makeSession({ nameEnglish: 'Second' });
      service.set(1, updated);
      expect(service.get(1)?.nameEnglish).toBe('Second');
    });

    it('resets TTL timer on overwrite', () => {
      const ttlMs = 30 * 60 * 1000;
      service.set(1, makeSession());
      // Advance halfway
      jest.advanceTimersByTime(ttlMs / 2);
      // Reset timer by calling set again
      service.set(1, makeSession({ nameEnglish: 'Reset' }));
      // Advance another half — original timer would have fired, but reset timer should not
      jest.advanceTimersByTime(ttlMs / 2);
      expect(service.get(1)).toBeDefined();
    });
  });

  describe('delete', () => {
    it('removes an existing session', () => {
      service.set(1, makeSession());
      service.delete(1);
      expect(service.get(1)).toBeUndefined();
    });

    it('is a no-op for unknown user', () => {
      expect(() => service.delete(999)).not.toThrow();
    });

    it('clears the TTL timer so it does not fire after delete', () => {
      service.set(1, makeSession());
      service.delete(1);
      // Advance past TTL — should not throw or cause issues
      jest.advanceTimersByTime(31 * 60 * 1000);
      expect(service.get(1)).toBeUndefined();
    });
  });

  describe('merge', () => {
    it('creates a new session if none exists', () => {
      service.merge(5, { nameEnglish: 'New User' });
      const session = service.get(5);
      expect(session).toBeDefined();
      expect(session?.nameEnglish).toBe('New User');
      expect(session?.step).toBe(ConversationStep.WELCOME);
      expect(session?.ocrAttempted).toBe(false);
    });

    it('merges partial data into existing session', () => {
      service.set(1, makeSession({ nameEnglish: 'Abebe', fan: '1234567890123456' }));
      service.merge(1, { nameAmharic: 'አበበ' });
      const session = service.get(1);
      expect(session?.nameEnglish).toBe('Abebe');
      expect(session?.fan).toBe('1234567890123456');
      expect(session?.nameAmharic).toBe('አበበ');
    });

    it('overwrites existing fields with merged values', () => {
      service.set(1, makeSession({ step: ConversationStep.WELCOME }));
      service.merge(1, { step: ConversationStep.NAME_AMHARIC });
      expect(service.get(1)?.step).toBe(ConversationStep.NAME_AMHARIC);
    });
  });

  describe('TTL expiry', () => {
    it('auto-deletes session after TTL elapses', () => {
      const ttlMs = 30 * 60 * 1000;
      service.set(1, makeSession());
      expect(service.get(1)).toBeDefined();
      jest.advanceTimersByTime(ttlMs + 1);
      expect(service.get(1)).toBeUndefined();
    });

    it('does not delete session before TTL elapses', () => {
      const ttlMs = 30 * 60 * 1000;
      service.set(1, makeSession());
      jest.advanceTimersByTime(ttlMs - 1000);
      expect(service.get(1)).toBeDefined();
    });

    it('respects SESSION_TTL_MINUTES env var', () => {
      process.env.SESSION_TTL_MINUTES = '5';
      // Create a new service instance with the custom TTL
      const customService = new SessionService();
      const fiveMinMs = 5 * 60 * 1000;
      customService.set(1, makeSession());
      jest.advanceTimersByTime(fiveMinMs + 1);
      expect(customService.get(1)).toBeUndefined();
      delete process.env.SESSION_TTL_MINUTES;
    });
  });
});
