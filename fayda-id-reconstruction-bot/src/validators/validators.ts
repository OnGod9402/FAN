export interface ValidationResult {
  valid: boolean;
  warning?: boolean;
  message?: string;
}

export function validateFan(value: string): ValidationResult {
  if (/^\d{16}$/.test(value)) return { valid: true };
  return { valid: false, message: 'Please enter a valid 16-digit card number (FAN).' };
}

export function validatePhone(value: string): ValidationResult {
  if (/^0[79]\d{8}$/.test(value)) return { valid: true };
  return {
    valid: false,
    warning: true,
    message:
      "Phone number doesn't match Ethiopian format (07XXXXXXXX or 09XXXXXXXX). Continue anyway? Reply with the number again to confirm.",
  };
}

export function validateFin(value: string): ValidationResult {
  if (/^FIN\s+[A-Z0-9]{8}\s+[A-Z0-9]{4}$/i.test(value)) return { valid: true };
  return { valid: false, message: 'Please enter FIN in format: FIN XXXXXXXX XXXX' };
}

export function validateSn(value: string): ValidationResult {
  if (/^SN:\s*\w+$/i.test(value)) return { valid: true };
  return { valid: false, message: 'Please enter SN in format: SN: XXXXXXX' };
}

export function validateEthiopianDate(value: string): ValidationResult {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{4}\/\d{2}\/\d{2}$/.test(value))
    return { valid: true };
  return {
    valid: false,
    message: 'Please enter date in Ethiopian format: DD/MM/YYYY or YYYY/MM/DD',
  };
}

export function validateGregorianDate(value: string): ValidationResult {
  if (/^\d{4}\/[A-Za-z]{3}\/\d{2}$/.test(value)) return { valid: true };
  return {
    valid: false,
    message: 'Please enter date in Gregorian format: YYYY/Mon/DD (e.g. 1981/Feb/02)',
  };
}
