import { FrontCardParser } from './front-card-parser';
import { BackCardParser } from './back-card-parser';

describe('FAN/FIN parser accuracy', () => {
  const frontParser = new FrontCardParser();
  const backParser = new BackCardParser();

  it('extracts FAN only from FAN-labeled area', () => {
    const text = `
      Ethiopian Digital ID Card
      Date of Birth 26/11/1972 | 1980/Aug/02
      FAN 5702 8049 5891 3612
      0900845403 FIN 7641 0516 7429
    `;
    const result = frontParser.parse(text);
    expect(result.fan).toBe('5702804958913612');
  });

  it('extracts FAN when OCR confuses characters and splits spacing', () => {
    const text = `
      Ethiopian Digital ID Card
      FAN
      57O2 8O49 589I 36|2
      Date of Birth 26/11/1972
    `;
    const result = frontParser.parse(text);
    expect(result.fan).toBe('5702804958913612');
  });

  it('extracts FIN only when FIN label is present', () => {
    const text = `
      Phone Number 0900845403
      FIN 7641 0516 7429
      Nationality Ethiopian
    `;
    const result = backParser.parse(text);
    expect(result.fin).toBe('FIN 7641 0516 7429');
  });

  it('does not fabricate FIN from random 12-digit chunks', () => {
    const text = `
      Phone 0900845403
      Address Adama City
      123456789012
    `;
    const result = backParser.parse(text);
    expect(result.fin).toBeUndefined();
  });
});
