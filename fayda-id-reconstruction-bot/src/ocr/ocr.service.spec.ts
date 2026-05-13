import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';

// Mock tesseract.js so tests don't require the actual binary
jest.mock('tesseract.js', () => ({
  default: {
    createWorker: jest.fn().mockResolvedValue({
      recognize: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

import Tesseract from 'tesseract.js';

describe('OcrService', () => {
  let service: OcrService;
  let mockWorker: { recognize: jest.Mock; terminate: jest.Mock };

  beforeEach(async () => {
    mockWorker = {
      recognize: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined),
    };
    (Tesseract.createWorker as jest.Mock).mockResolvedValue(mockWorker);

    const module: TestingModule = await Test.createTestingModule({
      providers: [OcrService],
    }).compile();

    service = module.get<OcrService>(OcrService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('extracts FAN from OCR text', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'Card number: 6583984273569179 some other text' },
    });
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result.fan).toBe('6583984273569179');
  });

  it('extracts FIN from OCR text', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'FIN 69518037 8327 other text' },
    });
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result.fin).toBe('FIN 69518037 8327');
  });

  it('extracts phone number from OCR text', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'Phone: 0722713403' },
    });
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result.phone).toBe('0722713403');
  });

  it('extracts Gregorian date from OCR text', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'DOB: 1981/Feb/02 expiry 2034/Mar/24' },
    });
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result.dobGregorian).toBe('1981/Feb/02');
    expect(result.expiryGregorian).toBe('2034/Mar/24');
  });

  it('extracts SN from OCR text', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: { text: 'SN: 6140549' },
    });
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result.sn).toBe('SN: 6140549');
  });

  it('returns empty object when OCR throws', async () => {
    mockWorker.recognize.mockRejectedValue(new Error('OCR failed'));
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result).toEqual({});
  });

  it('returns empty object when worker is not available', async () => {
    await service.onModuleDestroy();
    // Force worker to null by making init fail
    (Tesseract.createWorker as jest.Mock).mockRejectedValue(new Error('init failed'));
    await service.onModuleInit();
    const result = await service.extractFields(Buffer.from('fake'));
    expect(result).toEqual({});
  });
});
