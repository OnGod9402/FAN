import {
  validateFan,
  validatePhone,
  validateFin,
  validateSn,
  validateEthiopianDate,
  validateGregorianDate,
} from './validators';

describe('validateFan', () => {
  it('passes a valid 16-digit string', () => {
    expect(validateFan('6583984273569179').valid).toBe(true);
  });
  it('rejects 15 digits', () => {
    const r = validateFan('123456789012345');
    expect(r.valid).toBe(false);
    expect(r.message).toBeDefined();
  });
  it('rejects 17 digits', () => {
    expect(validateFan('12345678901234567').valid).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(validateFan('123456789012345A').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateFan('').valid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('passes 07XXXXXXXX format', () => {
    expect(validatePhone('0722713403').valid).toBe(true);
  });
  it('passes 09XXXXXXXX format', () => {
    expect(validatePhone('0912345678').valid).toBe(true);
  });
  it('returns warning (not hard error) for invalid format', () => {
    const r = validatePhone('0612345678');
    expect(r.valid).toBe(false);
    expect(r.warning).toBe(true);
    expect(r.message).toBeDefined();
  });
  it('returns warning for 9-digit number', () => {
    const r = validatePhone('072271340');
    expect(r.warning).toBe(true);
  });
  it('returns warning for empty string', () => {
    expect(validatePhone('').warning).toBe(true);
  });
});

describe('validateFin', () => {
  it('passes valid FIN format', () => {
    expect(validateFin('FIN 69518037 8327').valid).toBe(true);
  });
  it('passes lowercase fin', () => {
    expect(validateFin('fin 69518037 8327').valid).toBe(true);
  });
  it('rejects missing FIN prefix', () => {
    expect(validateFin('69518037 8327').valid).toBe(false);
  });
  it('rejects wrong spacing', () => {
    expect(validateFin('FIN695180378327').valid).toBe(false);
  });
  it('rejects wrong segment lengths', () => {
    expect(validateFin('FIN 6951803 8327').valid).toBe(false);
  });
});

describe('validateSn', () => {
  it('passes valid SN format', () => {
    expect(validateSn('SN: 6140549').valid).toBe(true);
  });
  it('passes SN with no space after colon', () => {
    expect(validateSn('SN:6140549').valid).toBe(true);
  });
  it('rejects missing colon', () => {
    expect(validateSn('SN 6140549').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateSn('').valid).toBe(false);
  });
});

describe('validateEthiopianDate', () => {
  it('passes DD/MM/YYYY format', () => {
    expect(validateEthiopianDate('25/05/1973').valid).toBe(true);
  });
  it('passes YYYY/MM/DD format', () => {
    expect(validateEthiopianDate('2026/07/15').valid).toBe(true);
  });
  it('rejects dash-separated date', () => {
    expect(validateEthiopianDate('25-05-1973').valid).toBe(false);
  });
  it('rejects Gregorian format', () => {
    expect(validateEthiopianDate('1981/Feb/02').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateEthiopianDate('').valid).toBe(false);
  });
});

describe('validateGregorianDate', () => {
  it('passes YYYY/Mon/DD format', () => {
    expect(validateGregorianDate('1981/Feb/02').valid).toBe(true);
  });
  it('passes with different month abbreviation', () => {
    expect(validateGregorianDate('2034/Mar/24').valid).toBe(true);
  });
  it('rejects numeric month', () => {
    expect(validateGregorianDate('1981/02/02').valid).toBe(false);
  });
  it('rejects wrong order', () => {
    expect(validateGregorianDate('Feb/1981/02').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateGregorianDate('').valid).toBe(false);
  });
});
