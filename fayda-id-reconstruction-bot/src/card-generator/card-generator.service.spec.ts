import { Test, TestingModule } from '@nestjs/testing';
import { CardGeneratorService } from './card-generator.service';
import { ConversationStep, SessionData } from '../session/session.types';
import sharp from 'sharp';

// Mock canvas, bwip-js, qrcode so tests run without native binaries
jest.mock('@napi-rs/canvas', () => {
  const mockCtx = {
    fillRect: jest.fn(),
    fillText: jest.fn(),
    strokeRect: jest.fn(),
    drawImage: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    addPage: jest.fn(),
    set font(_v: string) {},
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set globalAlpha(_v: number) {},
    set textAlign(_v: string) {},
  };
  const mockCanvas = {
    getContext: jest.fn().mockReturnValue(mockCtx),
    toBuffer: jest.fn().mockReturnValue(Buffer.from('PNG_MOCK')),
  };
  return {
    createCanvas: jest.fn().mockReturnValue(mockCanvas),
    loadImage: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    GlobalFonts: {
      registerFromPath: jest.fn(),
    },
  };
});

jest.mock('bwip-js', () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('BARCODE_MOCK')),
}));

jest.mock('qrcode', () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('QR_MOCK')),
}));

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    nameAmharic: 'አብደላ አቢቾ ዋቆ',
    nameEnglish: 'Abdella Abicho Waqo',
    dobEthiopian: '25/05/1973',
    dobGregorian: '1981/Feb/02',
    sexAmharic: 'ወንድ',
    sexEnglish: 'Male',
    expiryEthiopian: '2026/07/15',
    expiryGregorian: '2034/Mar/24',
    issueEthiopian: '2018/07/17',
    issueGregorian: '2026/Mar/26',
    fan: '6583984273569179',
    phone: '0722713403',
    fin: 'FIN 69518037 8327',
    nationalityAmharic: 'ኢትዮጵያ',
    nationalityEnglish: 'Ethiopian',
    regionAmharic: 'አርሚያ',
    regionEnglish: 'Oromia',
    zoneAmharic: 'አርሲ',
    zoneEnglish: 'Arsi',
    woredaAmharic: 'ጠና',
    woredaEnglish: 'Tena',
    sn: 'SN: 6140549',
    step: ConversationStep.DONE,
    ocrAttempted: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CardGeneratorService', () => {
  let service: CardGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardGeneratorService],
    }).compile();
    service = module.get<CardGeneratorService>(CardGeneratorService);
    service.onModuleInit();
  });

  describe('generateFront', () => {
    it('returns a Buffer', async () => {
      const portrait = Buffer.from('PORTRAIT_MOCK');
      const result = await service.generateFront(makeSession(), portrait);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('does not throw when portrait buffer is invalid', async () => {
      await expect(service.generateFront(makeSession(), Buffer.from(''))).resolves.toBeInstanceOf(
        Buffer,
      );
    });

    it('does not throw when FAN is empty', async () => {
      await expect(
        service.generateFront(makeSession({ fan: '' }), Buffer.from('PORTRAIT')),
      ).resolves.toBeInstanceOf(Buffer);
    });
  });

  describe('generateBack', () => {
    it('returns a Buffer', async () => {
      const result = await service.generateBack(makeSession());
      expect(result).toBeInstanceOf(Buffer);
    });

    it('does not throw when FIN is empty', async () => {
      await expect(service.generateBack(makeSession({ fin: '' }))).resolves.toBeInstanceOf(Buffer);
    });
  });
});
