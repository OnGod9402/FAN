export enum ConversationStep {
  WELCOME = 'WELCOME',
  AWAIT_IMAGES = 'AWAIT_IMAGES',
  REVIEW = 'REVIEW',
  GENERATING = 'GENERATING',
  DONE = 'DONE',
}

export interface SessionData {
  nameAmharic?: string;
  nameEnglish?: string;
  dobEthiopian?: string;
  dobGregorian?: string;
  sexAmharic?: string;
  sexEnglish?: string;
  expiryEthiopian?: string;
  expiryGregorian?: string;
  issueEthiopian?: string;
  issueGregorian?: string;
  fan?: string;
  phone?: string;
  fin?: string;
  nationalityAmharic?: string;
  nationalityEnglish?: string;
  regionAmharic?: string;
  regionEnglish?: string;
  zoneAmharic?: string;
  zoneEnglish?: string;
  woredaAmharic?: string;
  woredaEnglish?: string;
  sn?: string;
  qrCodeBuffer?: Buffer;
  portraitBuffer?: Buffer;
  processedPortrait?: Buffer;
  extractedQrBuffer?: Buffer;
  qrData?: string;
  step: ConversationStep;
  ocrAttempted: boolean;
  createdAt: Date;
  lang?: 'en' | 'am';
  theme?: 'warm' | 'bright';
  _collectedImages?: any[];
  _gotFront?: boolean;
  _gotBack?: boolean;
  _gotPortrait?: boolean;
  _pendingJobs?: number;
  _reviewSent?: boolean;
  _screenshotBuffer?: Buffer;
  _frontScreenshotBuffer?: Buffer;
  _backScreenshotBuffer?: Buffer;
  _portraitScreenshotBuffer?: Buffer;
  editState?: 'menu' | 'awaiting_value';
  editingField?: string;
  generatedCardId?: number;
  statusMsgId?: number;
}
