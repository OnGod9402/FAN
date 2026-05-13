import { Injectable } from '@nestjs/common';
import { SessionData } from '../session/session.types';

@Injectable()
export class BackCardParser {
  public parse(text: string): Partial<SessionData> {
    const result: Partial<SessionData> = {};
    const normalized = text.replace(/[¦]/g, '|');
    const lines = normalized
      .split('\n')
      .map((line) => this.cleanValue(line))
      .filter(Boolean);

    const phoneMatch = normalized.match(/\b0[79][\s\d]{8,10}\b/);
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/\s/g, '');
      if (result.phone.length > 10) result.phone = result.phone.slice(0, 10);
    }

    const fin = this.extractFin(lines, normalized);
    if (fin) result.fin = fin;

    const nationalityIdx = lines.findIndex((line) => /Nationality/i.test(line) || /ዜግነት/.test(line));
    if (nationalityIdx !== -1) {
      // Skip past the label line and "Self Declared" line — look only at value lines
      const valueLines = lines
        .slice(nationalityIdx + 1, nationalityIdx + 6)
        .filter((line) => !/Self|Declared|Nationality|ዜግነት|በግንባር|ወልቃ/i.test(line));

      // Try to find "ኢትዮጵያ | Ethiopian" style pair in value lines
      const valueBlock = valueLines.join(' ');
      const pairMatch = valueBlock.match(/([\u1200-\u137F]{2,})\s*\|\s*([A-Za-z][A-Za-z ]{2,})/);
      if (pairMatch) {
        result.nationalityAmharic = this.cleanValue(pairMatch[1]);
        result.nationalityEnglish = this.cleanValue(pairMatch[2]);
      } else {
        // Fallback: find separate Amharic and English lines
        const amLine = valueLines.find((line) => /[\u1200-\u137F]/.test(line));
        const enLine = valueLines.find((line) => /[A-Za-z]/.test(line) && !/Self|Declared|Nationality|Address/i.test(line));
        if (amLine) result.nationalityAmharic = this.cleanValue(amLine);
        if (enLine) result.nationalityEnglish = this.cleanValue(enLine);
      }
    }

    const addressIdx = lines.findIndex((line) => /Address/i.test(line) || /አድራሻ/.test(line));
    if (addressIdx !== -1) {
      const addressWindow = lines
        .slice(addressIdx + 1, addressIdx + 14)
        .filter((line) => !/Phone|FIN|Nationality|Self|Declared|SN\b/i.test(line))
        .filter((line) => line !== '|');

      const amAddress = addressWindow.filter((line) => /[\u1200-\u137F]/.test(line));
      const enAddress = addressWindow.filter((line) => /[A-Za-z]/.test(line));

      if (amAddress[0]) result.regionAmharic = this.cleanValue(amAddress[0]);
      if (amAddress[1]) result.zoneAmharic = this.cleanValue(amAddress[1]);
      if (amAddress[2]) result.woredaAmharic = this.cleanValue(amAddress[2]);

      if (enAddress[0]) result.regionEnglish = this.cleanValue(enAddress[0]);
      if (enAddress[1]) result.zoneEnglish = this.cleanValue(enAddress[1]);
      if (enAddress[2]) result.woredaEnglish = this.cleanValue(enAddress[2]);
    }

    const snMatch = normalized.match(/\bSN\b[:\s]*([A-Z0-9-]{4,})/i);
    if (snMatch) {
      result.sn = `SN: ${snMatch[1]}`;
    }

    return result;
  }

  private cleanValue(value: string): string {
    return value
      .replace(/[=|\\/\-_:፡።፣፤]+$/, '')
      .replace(/^\s*[|=\-_:፡።፣፤]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractFin(lines: string[], normalized: string): string | undefined {
    const finIdx = lines.findIndex((line) => /\bF[1I|L]N\b|\bFIN\b/i.test(line));
    const searchSpace =
      finIdx !== -1
        ? lines.slice(Math.max(0, finIdx - 2), Math.min(lines.length, finIdx + 3)).join(' ')
        : normalized;

    // FIN should be 12 digits shown as 4-4-4. Keep extraction label-anchored.
    const grouped = searchSpace.match(/\bF[1I|L]N\b[\s:=-]*(\d{4})\s*(\d{4})\s*(\d{4})\b/i);
    if (grouped) return `FIN ${grouped[1]} ${grouped[2]} ${grouped[3]}`;

    const explicit = searchSpace.match(/\bFIN\b[\s:=-]*(\d{8})\s*(\d{4})\b/i);
    if (explicit) return `FIN ${explicit[1]} ${explicit[2]}`;

    return undefined;
  }
}
