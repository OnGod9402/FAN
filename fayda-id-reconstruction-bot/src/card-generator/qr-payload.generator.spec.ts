import { Decoder } from 'cbor-x';
import { QrPayloadGenerator } from './qr-payload.generator';
import { ConversationStep, SessionData } from '../session/session.types';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    nameEnglish: 'Atsede Alebachew Kedebe',
    dobGregorian: '1980/Aug/02',
    issueGregorian: '2026/Mar/26',
    expiryGregorian: '2034/May/04',
    fan: '5702804958913612',
    phone: '0900845403',
    fin: 'FIN 7641 0516 7429',
    step: ConversationStep.REVIEW,
    ocrAttempted: true,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('QrPayloadGenerator format fidelity', () => {
  const generator = new QrPayloadGenerator();
  const decoder = new Decoder({ mapsAsObjects: false });

  it('emits COSE_Sign1 with expected payload key layout', async () => {
    const encoded = await generator.generate(makeSession());
    const top = decoder.decode(encoded) as any;
    const arr = top.value ?? top;

    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(4);
    expect(Buffer.from(arr[0]).toString('hex')).toBe('a10126');

    const unprotected = arr[1] as Map<number, unknown>;
    expect(unprotected.get(4)).toBeDefined();
    expect(Buffer.from(unprotected.get(4) as Uint8Array).toString('utf8')).toBe(
      'qutPw5l_Vk6dWsw6xH37ZeDrR556IF0JNtQUJOpuHco',
    );

    const payload = decoder.decode(Buffer.from(arr[2])) as Map<number, unknown>;
    expect(payload.has(2)).toBe(true);
    expect(payload.has(4)).toBe(true);
    expect(payload.has(7)).toBe(true);
    expect(payload.has(169)).toBe(true);

    const profile = payload.get(169) as Map<number, unknown>;
    expect(profile.get(2)).toBe('1.0');
    expect(profile.get(99)).toBe('eFayda');
    expect(profile.get(12)).toBe('+251 900845403');
    expect(profile.get(13)).toBe('ET');
    expect(profile.has(62)).toBe(true);

    expect(Buffer.from(arr[3]).length).toBe(64);
  });
});
