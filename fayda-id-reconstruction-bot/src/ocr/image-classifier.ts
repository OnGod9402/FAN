import { Injectable, Logger } from '@nestjs/common';

export type ImageType = 'front' | 'back' | 'portrait';

@Injectable()
export class ImageClassifier {
  private readonly logger = new Logger(ImageClassifier.name);

  public classify(rawText: string): ImageType {
    const text = rawText.toUpperCase();

    // App UI detection — if text contains Fayda app navigation/UI elements,
    // it's a screenshot of the app dashboard (portrait popup), NOT a card.
    const appUiKeywords = [
      'ANNOUNCEMENT', 'SERVICES', 'READ-MORE', 'DATA-U', 'ETHIO',
      'CAPTURE MORE', 'PORT',
    ];
    let appUiMatches = 0;
    for (const kw of appUiKeywords) {
      if (text.includes(kw)) appUiMatches++;
    }

    const frontKeywords = [
      'FULL NAME', 'DATE OF BIRTH', 'FAYDA', 'FAN', 'SEX', 'EXPIRY', 'ካርድ ቁጥር', 'ሙሉ ስም', 'ፆታ'
    ];
    let frontMatches = 0;
    for (const kw of frontKeywords) {
      if (text.includes(kw)) frontMatches++;
    }

    const backKeywords = [
      'PHONE', 'FIN', 'NATIONALITY', 'ADDRESS', 'ስልክ', 'ዜግነት', 'አድራሻ'
    ];
    let backMatches = 0;
    for (const kw of backKeywords) {
      if (text.includes(kw)) backMatches++;
    }

    this.logger.debug(
      `Classifier: front=${frontMatches} back=${backMatches} appUI=${appUiMatches}`,
    );

    // If it looks like an app UI screenshot, classify as portrait
    // unless it has very strong card keyword matches
    if (appUiMatches >= 2 && frontMatches < 3 && backMatches < 3) {
      return 'portrait';
    }

    // Back card with many strong keywords (phone + fin + nationality) wins
    if (backMatches >= 3) {
      return 'back';
    }

    // Front needs at least 2 matches to avoid false positives from app UI "FAN:" labels
    if (frontMatches >= 2 && frontMatches > backMatches) {
      return 'front';
    }

    if (backMatches > 0 && backMatches > frontMatches) {
      return 'back';
    }

    // Single front keyword is too weak — only use if no back matches at all
    if (frontMatches === 1 && backMatches === 0 && appUiMatches === 0) {
      return 'front';
    }

    if (backMatches >= 1) {
      return 'back';
    }

    return 'portrait';
  }
}
