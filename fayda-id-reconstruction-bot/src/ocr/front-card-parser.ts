import { Injectable } from '@nestjs/common';
import { SessionData } from '../session/session.types';
import { getCurrentEthiopianDate, getCurrentGregorianDate } from '../utils/date.util';

@Injectable()
export class FrontCardParser {
  public parse(text: string, verticalText: string = ''): Partial<SessionData> {
    const result: Partial<SessionData> = {};
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

    const nameIdx = lines.findIndex((line) =>
      /Full.?Name/i.test(line) || /መስ.*ስም/.test(line) || /ሙሉ.*ስም/.test(line),
    );
    if (nameIdx !== -1) {
      for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, lines.length); i++) {
        const line = lines[i];
        if (!line || /Date.?of/i.test(line) || /ቀን/.test(line)) break;
        if (/[\u1200-\u137F]/.test(line) && !result.nameAmharic) {
          // Strip trailing non-Ethiopic junk (digits, Latin chars) from OCR
          const cleaned = line.replace(/[\s\d A-Za-z=|\\\-_:፡።፣፤፦]+$/, '').trim();
          result.nameAmharic = this.cleanValue(cleaned);
        } else if (/^[A-Z][a-z]/.test(line) && !result.nameEnglish) {
          const strippedLine = line.replace(/[\u1200-\u137F]/g, '');
          result.nameEnglish = this.cleanValue(strippedLine);
        }
      }
    }

    const dobIdx = lines.findIndex((line) => /Date.?of.?Birth/i.test(line) || /የትውልድ/.test(line));
    if (dobIdx !== -1) {
      const dobBlock = lines.slice(dobIdx + 1, dobIdx + 5).join(' ');
      const eth = dobBlock.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      const greg = dobBlock.match(/\b(\d{4})\/([A-Za-z]{3})\/(\d{2})\b/);
      if (eth) result.dobEthiopian = `${eth[1]}/${eth[2]}/${eth[3]}`;
      if (greg) result.dobGregorian = `${greg[1]}/${greg[2]}/${greg[3]}`;
    }

    const sexIdx = lines.findIndex((line) => /\bSex\b/i.test(line) || /ፆታ/.test(line));
    if (sexIdx !== -1) {
      const sexBlock = lines.slice(sexIdx, sexIdx + 5).join(' ');
      if (/\bMale\b/i.test(sexBlock)) result.sexEnglish = 'Male';
      else if (/\bFemale\b/i.test(sexBlock)) result.sexEnglish = 'Female';
      if (/ወንድ/.test(sexBlock)) result.sexAmharic = 'ወንድ';
      else if (/ሴት/.test(sexBlock)) result.sexAmharic = 'ሴት';
    }
    if (!result.sexEnglish) {
      if (/\bMale\b/i.test(text)) result.sexEnglish = 'Male';
      else if (/\bFemale\b/i.test(text)) result.sexEnglish = 'Female';
    }
    if (!result.sexAmharic) {
      if (/ወንድ/.test(text)) result.sexAmharic = 'ወንድ';
      else if (/ሴት/.test(text)) result.sexAmharic = 'ሴት';
    }

    const expIdx = lines.findIndex((line) => /Date.?of.?Expiry/i.test(line) || /የሚያበቃ/.test(line));
    if (expIdx !== -1) {
      const expBlock = lines.slice(expIdx + 1, expIdx + 5).join(' ');
      const ethDD = expBlock.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      const ethYY = expBlock.match(/\b(\d{4})\/(\d{2})\/(\d{2})\b/);
      const greg = expBlock.match(/\b(\d{4})\/([A-Za-z]{3})\/(\d{2})\b/);
      if (ethDD) result.expiryEthiopian = `${ethDD[1]}/${ethDD[2]}/${ethDD[3]}`;
      else if (ethYY) result.expiryEthiopian = `${ethYY[1]}/${ethYY[2]}/${ethYY[3]}`;
      if (greg) result.expiryGregorian = `${greg[1]}/${greg[2]}/${greg[3]}`;
    }

    // Attempt to extract issue dates from the dedicated vertical text OCR pass first
    if (verticalText) {
      const vertGreg = verticalText.match(/\b(\d{4})\/([A-Za-z]{3})\/(\d{2})\b/);
      if (vertGreg) result.issueGregorian = `${vertGreg[1]}/${vertGreg[2]}/${vertGreg[3]}`;

      const vertEth = verticalText.match(/\b(\d{4})\/(\d{2})\/(\d{2})\b/);
      if (vertEth) result.issueEthiopian = `${vertEth[1]}/${vertEth[2]}/${vertEth[3]}`;
    }

    // Fallback to old heuristic if missing
    if (!result.issueGregorian || !result.issueEthiopian) {
      const allGreg = [...text.matchAll(/\b(\d{4})\/([A-Za-z]{3})\/(\d{2})\b/g)]
        .map((match) => `${match[1]}/${match[2]}/${match[3]}`);
      const allEthYY = [...text.matchAll(/\b(\d{4})\/(\d{2})\/(\d{2})\b/g)]
        .map((match) => `${match[1]}/${match[2]}/${match[3]}`);

      if (!result.issueGregorian && allGreg.length >= 3) result.issueGregorian = allGreg[2];
      if (!result.issueEthiopian && allEthYY.length >= 3) result.issueEthiopian = allEthYY[2];
    }

    // Fallback to current dates if completely missing
    if (!result.issueGregorian) {
      result.issueGregorian = getCurrentGregorianDate();
    }
    if (!result.issueEthiopian) {
      result.issueEthiopian = getCurrentEthiopianDate();
    }

    result.fan = this.extractFan(lines);

    return result;
  }

  private extractFan(lines: string[]): string | undefined {
    // Stage A: strict labeled-line parse.
    const labeledLine = lines.find((line) => this.isFanLabelLine(line));
    if (labeledLine) {
      const hit = this.extractFanDigits(this.normalizeFanLine(labeledLine));
      if (hit) return hit;
    }

    // Stage B: local FAN window parse around label.
    const fanIdx = lines.findIndex((line) => this.isFanLabelLine(line));
    if (fanIdx !== -1) {
      const windowText = lines
        .slice(Math.max(0, fanIdx - 2), Math.min(lines.length, fanIdx + 3))
        .map((line) => this.normalizeFanLine(line))
        .join(' ');
      const hit = this.extractFanDigits(windowText);
      if (hit) return hit;
    }

    // Stage C: constrained lower-band fallback.
    const lowerLines = lines.slice(Math.floor(lines.length * 0.45));
    for (const line of lowerLines) {
      if (/\bFIN\b|Phone|Date|SN\b/i.test(line)) continue;
      const norm = this.normalizeFanLine(line);
      const hit = this.extractFanDigits(norm);
      if (hit) return hit;
    }

    return undefined;
  }

  private isFanLabelLine(line: string): boolean {
    return /\bFAN\b/i.test(line) || /ካርድ.*ቁጥር/.test(line);
  }

  private normalizeFanLine(line: string): string {
    return line
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[^\d\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractFanDigits(input: string): string | undefined {
    const grouped = input.match(/(\d{4})\s+(\d{4})\s+(\d{4})\s+(\d{4})/);
    if (grouped) {
      return `${grouped[1]}${grouped[2]}${grouped[3]}${grouped[4]}`;
    }
    const exact = input.replace(/\s/g, '').match(/\d{16}/);
    return exact ? exact[0] : undefined;
  }

  private cleanValue(value: string): string {
    return value
      .replace(/[\u25A0-\u26FF\u2700-\u27BF=|\\/\-_:፡።፣፤]+$/, '')
      .replace(/^\s*[|=\-_:፡።፣፤]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
