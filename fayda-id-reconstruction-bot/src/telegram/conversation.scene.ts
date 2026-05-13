import { Logger } from '@nestjs/common';
import { Markup, Scenes } from 'telegraf';
import { Mutex } from 'async-mutex';
import { SessionService } from '../session/session.service';
import { OcrService } from '../ocr/ocr.service';
import { PhotoProcessorService } from '../photo-processor/photo-processor.service';
import { CardGeneratorService } from '../card-generator/card-generator.service';
import { CardHistoryService } from '../history/card-history.service';
import { BackgroundTaskService } from './background-task.service';
import { ConversationStep, SessionData } from '../session/session.types';
import { validateFan, validateFin } from '../validators/validators';
import { Decoder } from 'cbor-x';

// Global mutex to serialize native addon operations (canvas, ONNX, face-api)
// and prevent C++ heap corruption from concurrent access
const nativeMutex = new Mutex();

type BotContext = Scenes.WizardContext;
type Lang = 'en' | 'am';

const logger = new Logger('ConversationScene');
const cborDecoder = new Decoder({ mapsAsObjects: false });

const T = {
  en: {
    welcome: '🇪🇹 *Fayda ID Reconstruction Tool*\n\nSelect language:',
    langSet: '🇬🇧 English',
    guideCollect:
      '📲 *Please send your 3 images in any order:*\n\n' +
      '1. Front screenshot\n' +
      '2. Back screenshot (phone, FIN, address)\n' +
      '3. Portrait photo (face clearly visible)',
    guideResend: '📲 *Please send {count} missing image(s) to continue.*',
    typeFront: 'Front screenshot',
    typeBack: 'Back screenshot',
    typePortrait: 'Portrait photo',
    receivedMsg: '✅ Image received ({current}/{total}). Please send the next.',
    identifying: '⏳ All images received. Identifying and processing…',
    processing: '⏳ Finalising card — this takes a few seconds…',
    reviewTitle: '📋 *Extracted data — please review:*\n\n',
    confirmBtn: '✅ Generate Card',
    resendFrontBtn: '🔄 Resend Front',
    resendBackBtn: '🔄 Resend Back',
    resendPortraitBtn: '🔄 Resend Portrait',
    done: '✅ *ID card #{count} generated.*\n\nSend /start to process another.',
    error: '❌ Generation failed. Send /start to try again.',
    ocrWarn: '⚠️ Could not read some fields from that screenshot — you can still generate the card or resend a clearer image.',
    editBtn: '📝 Edit Fields',
    editMenuTitle: '📝 *Select a field to edit:*',
    typeNewValue: '✏️ Please send the correct value for *{field}*:',
    backBtn: '⬅️ Back to Review',
    editGeneratedBtn: '🛠 Edit Generated Card',
    generatedReviewTitle: '🧾 *Generated card data — you can edit and regenerate:*',
    regenerateBtn: '🔁 Regenerate Card',
    generatedMissing: '❌ We could not find that card. Please generate a new one.',
    invalidFan: '⚠️ FAN must be exactly 16 digits.',
    invalidFin: '⚠️ FIN must be in format: FIN XXXXXXXX XXXX',
    busy: '⏳ Server is busy right now. Please try again in a minute.',
  },
  am: {
    welcome: '🇪🇹 *የፋይዳ መታወቂያ ካርድ መልሶ ማዘጋጃ*\n\nቋንቋ ይምረጡ:',
    langSet: '🇪🇹 አማርኛ',
    guideCollect:
      '📲 *እባክዎ 3ቱን ምስሎች በማንኛውም ቅደም ተከተል ይላኩ:*\n\n' +
      '1. የፊት ስክሪንሾት\n' +
      '2. የኋላ ስክሪንሾት (ስልክ/FIN/አድራሻ)\n' +
      '3. የፎቶ ምስል (ፊት ግልጽ የሚታይበት)',
    guideResend: '📲 *ያልተሟላውን {count} ምስል ይላኩ።*',
    typeFront: 'የፊት ገጽ ስክሪንሾት',
    typeBack: 'የኋላ ገጽ ስክሪንሾት',
    typePortrait: 'የፎቶ ምስል',
    receivedMsg: '✅ ምስል ደርሷል ({current}/{total})። እባክዎ ቀጣዩን ይላኩ።',
    identifying: '⏳ ሁሉም ምስሎች ደርሰዋል። በመለየት ላይ…',
    processing: '⏳ ካርድ እየተዘጋጀ ነው…',
    reviewTitle: '📋 *የተነበበ ውሂብ — እባክዎ ያረጋግጡ:*\n\n',
    confirmBtn: '✅ ካርድ ፍጠር',
    resendFrontBtn: '🔄 የፊት ገጽ ድጋሚ',
    resendBackBtn: '🔄 የኋላ ገጽ ድጋሚ',
    resendPortraitBtn: '🔄 ፎቶ ድጋሚ',
    done: '✅ *ካርድ #{count} ተዘጋጅቷል።*\n\nሌላ ለማዘጋጀት /start ይጫኑ።',
    error: '❌ ካርዱን ማዘጋጀት አልተቻለም። /start ይጫኑ።',
    ocrWarn: '⚠️ አንዳንድ መረጃዎችን ማንበብ አልተቻለም — ካርዱን መፍጠር ወይም ግልጽ ምስል ድጋሚ መላክ ይችላሉ።',
    editBtn: '📝 መረጃ አስተካክል',
    editMenuTitle: '📝 *ለማስተካከል የሚፈልጉትን ይምረጡ:*',
    typeNewValue: '✏️ እባክዎ ትክክለኛውን የ *{field}* መረጃ ይላኩ:',
    backBtn: '⬅️ ተመለስ',
    editGeneratedBtn: '🛠 የተፈጠረውን ካርድ አስተካክል',
    generatedReviewTitle: '🧾 *የተፈጠረው የካርድ መረጃ — አርትዕ እና እንደገና ፍጠር:*',
    regenerateBtn: '🔁 ካርድ እንደገና ፍጠር',
    generatedMissing: '❌ ይህ ካርድ አልተገኘም። እባክዎ አዲስ ካርድ ይፍጠሩ።',
    invalidFan: '⚠️ FAN ትክክል 16 አሃዝ መሆን አለበት።',
    invalidFin: '⚠️ FIN ቅርጸት: FIN XXXXXXXX XXXX',
    busy: '⏳ ሰርቨሩ በአሁኑ ጊዜ ሥራ ላይ ነው። እባክዎ ከደቂቃ በኋላ ይሞክሩ።',
  },
};

const REVIEW_FIELDS: Array<{ key: keyof SessionData; label: { en: string; am: string } }> = [
  { key: 'nameAmharic',      label: { en: 'Full Name (Amharic)',       am: 'ሙሉ ስም (አማርኛ)' } },
  { key: 'nameEnglish',      label: { en: 'Full Name (English)',       am: 'ሙሉ ስም (እንግሊዝኛ)' } },
  { key: 'dobEthiopian',     label: { en: 'DOB (Ethiopian)',           am: 'የትውልድ ቀን (ኢትዮጵያ)' } },
  { key: 'dobGregorian',     label: { en: 'DOB (Gregorian)',           am: 'የትውልድ ቀን (ጎርጎሪያን)' } },
  { key: 'sexAmharic',       label: { en: 'Sex (Amharic)',             am: 'ፆታ (አማርኛ)' } },
  { key: 'sexEnglish',       label: { en: 'Sex (English)',             am: 'ፆታ (እንግሊዝኛ)' } },
  { key: 'expiryEthiopian',  label: { en: 'Expiry (Ethiopian)',        am: 'ያበቃበት ቀን (ኢትዮጵያ)' } },
  { key: 'expiryGregorian',  label: { en: 'Expiry (Gregorian)',        am: 'ያበቃበት ቀን (ጎርጎሪያን)' } },
  { key: 'issueEthiopian',   label: { en: 'Issue (Ethiopian)',         am: 'የተሰጠበት ቀን (ኢትዮጵያ)' } },
  { key: 'issueGregorian',   label: { en: 'Issue (Gregorian)',         am: 'የተሰጠበት ቀን (ጎርጎሪያን)' } },
  { key: 'fan',              label: { en: 'FAN',                       am: 'FAN' } },
  { key: 'phone',            label: { en: 'Phone',                     am: 'ስልክ' } },
  { key: 'fin',              label: { en: 'FIN',                       am: 'FIN' } },
  { key: 'nationalityAmharic', label: { en: 'Nationality (Amharic)',  am: 'ዜግነት (አማርኛ)' } },
  { key: 'nationalityEnglish', label: { en: 'Nationality (English)',  am: 'ዜግነት (እንግሊዝኛ)' } },
  { key: 'regionEnglish',    label: { en: 'Region',                    am: 'ክልል' } },
  { key: 'zoneEnglish',      label: { en: 'Zone',                      am: 'ዞን' } },
  { key: 'woredaEnglish',    label: { en: 'Woreda',                    am: 'ወረዳ' } },
  { key: 'sn',               label: { en: 'SN',                        am: 'SN' } },
];

const REQUIRED_FIELD_GROUPS: Array<{
  groupLabel: { en: string; am: string };
  fields: Array<{ key: keyof SessionData; tag: string }>;
}> = [
  {
    groupLabel: { en: 'Full Name', am: 'ሙሉ ስም' },
    fields: [
      { key: 'nameAmharic', tag: 'አማርኛ' },
      { key: 'nameEnglish', tag: 'English' },
    ],
  },
  {
    groupLabel: { en: 'Date of Birth', am: 'የትውልድ ቀን' },
    fields: [
      { key: 'dobEthiopian', tag: 'Ethiopian' },
      { key: 'dobGregorian', tag: 'Gregorian' },
    ],
  },
  {
    groupLabel: { en: 'Sex', am: 'ፆታ' },
    fields: [
      { key: 'sexAmharic', tag: 'አማርኛ' },
      { key: 'sexEnglish', tag: 'English' },
    ],
  },
  {
    groupLabel: { en: 'FAN', am: 'FAN' },
    fields: [{ key: 'fan', tag: '' }],
  },
  {
    groupLabel: { en: 'Phone', am: 'ስልክ' },
    fields: [{ key: 'phone', tag: '' }],
  },
  {
    groupLabel: { en: 'FIN', am: 'FIN' },
    fields: [{ key: 'fin', tag: '' }],
  },
  {
    groupLabel: { en: 'Nationality', am: 'ዜግነት' },
    fields: [
      { key: 'nationalityAmharic', tag: 'አማርኛ' },
      { key: 'nationalityEnglish', tag: 'English' },
    ],
  },
  {
    groupLabel: { en: 'Region', am: 'ክልል' },
    fields: [
      { key: 'regionAmharic', tag: 'አማርኛ' },
      { key: 'regionEnglish', tag: 'English' },
    ],
  },
];

function buildMissingFieldsWarning(
  session: SessionData,
  lang: Lang,
): { text: string; buttons: any[][] } | null {
  const missing: Array<{ groupLabel: string; fields: Array<{ key: string; tag: string }> }> = [];

  for (const group of REQUIRED_FIELD_GROUPS) {
    const empty = group.fields.filter((f) => !session[f.key]);
    if (empty.length > 0) {
      missing.push({
        groupLabel: `${group.groupLabel.en} / ${group.groupLabel.am}`,
        fields: empty,
      });
    }
  }

  if (missing.length === 0) return null;

  let text =
    lang === 'en'
      ? '⚠️ *Missing fields — please fill in:*\n\n'
      : '⚠️ *ያልተሞሉ መረጃዎች — እባክዎ ያስገቡ:*\n\n';

  const buttons: any[][] = [];

  for (const group of missing) {
    const tags = group.fields.map((f) => f.tag).filter(Boolean);
    text += `• ${group.groupLabel}`;
    if (tags.length > 0) text += ` (${tags.join(' & ')})`;
    text += ' ❌\n';

    const row = group.fields.map((f) => {
      const fieldInfo = REVIEW_FIELDS.find((rf) => rf.key === f.key);
      const btnLabel = fieldInfo ? fieldInfo.label[lang] : f.key;
      return Markup.button.callback(`✏️ ${btnLabel}`, `edit_f_${f.key}`);
    });
    buttons.push(row);
  }

  buttons.push([Markup.button.callback(T[lang].confirmBtn, 'confirm_all')]);

  return { text, buttons };
}

function getLang(sessionService: SessionService, userId: number): Lang {
  return ((sessionService.get(userId) as (SessionData & { lang?: Lang }) | undefined)?.lang) ?? 'en';
}

function buildReview(session: SessionData, lang: Lang): string {
  let msg = T[lang].reviewTitle;
  for (const f of REVIEW_FIELDS) {
    const val = session[f.key] as string | undefined;
    if (val) {
      msg += `*${f.label[lang]}:* \`${val}\`\n`;
    }
  }
  return msg;
}

function extractFieldsFromQrData(qrData: string): Partial<SessionData> {
  const result: Partial<SessionData> = {};
  try {
    const raw = Buffer.from(qrData, 'base64');
    if (!raw.length) return result;
    const top = cborDecoder.decode(raw) as any;
    const arr = top?.value ?? top;
    if (!Array.isArray(arr) || arr.length < 3) return result;
    const payload = cborDecoder.decode(Buffer.from(arr[2])) as Map<number, unknown>;
    if (!(payload instanceof Map)) return result;

    // FAN — key 2 in payload
    const fan = payload.get(2);
    if (typeof fan === 'string') {
      const digits = fan.replace(/\D/g, '');
      if (digits.length === 16) result.fan = digits;
    }

    // Profile map — key 169 in payload
    const profile = payload.get(169);
    if (profile instanceof Map) {
      // Name — key 4
      const name = profile.get(4);
      if (typeof name === 'string' && name.length > 1) {
        result.nameEnglish = name;
      }

      // DOB — key 8 (format: "YYYYMMDD")
      const dob = profile.get(8);
      if (typeof dob === 'string' && dob.length === 8) {
        const y = dob.slice(0, 4);
        const m = parseInt(dob.slice(4, 6), 10);
        const d = dob.slice(6, 8);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        result.dobGregorian = `${y}/${months[m - 1] ?? 'Jan'}/${d}`;
      }

      // Phone — key 12 (format: "+251 9XXXXXXXX")
      const phone = profile.get(12);
      if (typeof phone === 'string') {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('251') && digits.length >= 12) {
          result.phone = '0' + digits.slice(3);
        }
      }
    }
  } catch {
    // Ignore decode errors
  }
  return result;
}

async function downloadPhoto(ctx: BotContext): Promise<Buffer | null> {
  const msg = ctx.message as { photo?: Array<{ file_id: string }> } | undefined;
  if (!msg?.photo?.length) return null;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  return Buffer.from(await res.arrayBuffer());
}

async function showReviewDialog(
  ctx: BotContext,
  userId: number,
  lang: Lang,
  sessionService: SessionService,
  bgTaskService: BackgroundTaskService,
  cardService?: CardGeneratorService,
) {
  sessionService.merge(userId, { step: ConversationStep.REVIEW } as Partial<SessionData>);

  const bg = bgTaskService.get(userId);

  const [frontFields, backFields, qrData] = await Promise.all([
    bg.frontOcr ?? Promise.resolve({}),
    bg.backOcr  ?? Promise.resolve({}),
    bg.qrData   ?? Promise.resolve(null),
  ]);

  sessionService.merge(userId, {
    ...frontFields,
    ...backFields,
    ...(qrData ? { qrData } : {}),
    ocrAttempted: true,
  } as Partial<SessionData>);

  // Use QR CBOR data to fill ANY missing fields (name, DOB, phone, FAN)
  if (qrData) {
    const current = sessionService.get(userId)!;
    const qrFields = extractFieldsFromQrData(qrData);
    const fallbacks: Partial<SessionData> = {};

    if (!current.fan && qrFields.fan) fallbacks.fan = qrFields.fan;
    if (!current.nameEnglish && qrFields.nameEnglish) fallbacks.nameEnglish = qrFields.nameEnglish;
    if (!current.dobGregorian && qrFields.dobGregorian) fallbacks.dobGregorian = qrFields.dobGregorian;
    if (!current.phone && qrFields.phone) fallbacks.phone = qrFields.phone;

    if (Object.keys(fallbacks).length > 0) {
      logger.log(`[${userId}] QR fallback filling: ${Object.keys(fallbacks).join(', ')}`);
      sessionService.merge(userId, fallbacks as Partial<SessionData>);
    }
  }

  const session = sessionService.get(userId)!;
  const hasData = Object.keys(frontFields).length > 0 || Object.keys(backFields).length > 0;

  // Pre-compute QR in the background while the user reads the review!
  if (cardService && !bg.qrImage) {
    const portraitPromise = bg.portrait ?? Promise.resolve(Buffer.alloc(0));
    bg.qrImage = portraitPromise.then(portrait =>
      cardService.precomputeQr(session, portrait)
    ).catch(() => Buffer.alloc(0));
    logger.log(`[${userId}] QR pre-computation started in background`);
  }

  let reviewMsg = buildReview(session, lang);
  if (!hasData) reviewMsg = T[lang].ocrWarn + '\n\n' + reviewMsg;

  await ctx.reply(reviewMsg, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(T[lang].confirmBtn, 'confirm_all')],
      [Markup.button.callback(T[lang].editBtn, 'edit_menu')],
      [
        Markup.button.callback(T[lang].resendFrontBtn, 'resend_front'),
        Markup.button.callback(T[lang].resendBackBtn, 'resend_back'),
      ],
      [Markup.button.callback(T[lang].resendPortraitBtn, 'resend_portrait')],
    ]),
  });

  const missingWarning = buildMissingFieldsWarning(session, lang);
  if (missingWarning) {
    await ctx.reply(missingWarning.text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(missingWarning.buttons),
    });
  }
}

async function showEditMenu(ctx: BotContext, lang: Lang) {
  const buttons: any[] = [];
  // Arrange in rows of 2
  for (let i = 0; i < REVIEW_FIELDS.length; i += 2) {
    const row = [];
    row.push(Markup.button.callback(REVIEW_FIELDS[i].label[lang], `edit_f_${REVIEW_FIELDS[i].key}`));
    if (i + 1 < REVIEW_FIELDS.length) {
      row.push(Markup.button.callback(REVIEW_FIELDS[i + 1].label[lang], `edit_f_${REVIEW_FIELDS[i + 1].key}`));
    }
    buttons.push(row);
  }
  buttons.push([Markup.button.callback(T[lang].backBtn, 'edit_back')]);

  await ctx.reply(T[lang].editMenuTitle, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

async function showGeneratedCardReview(ctx: BotContext, session: SessionData, lang: Lang, cardId: number) {
  const body = `${T[lang].generatedReviewTitle}\n\n${buildReview(session, lang)}`;
  await ctx.reply(body, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(T[lang].regenerateBtn, 'confirm_generated')],
      [Markup.button.callback(T[lang].editBtn, 'edit_menu')],
      [Markup.button.callback(T[lang].backBtn, 'edit_back')],
      [Markup.button.callback(T[lang].editGeneratedBtn, `edit_generated_${cardId}`)],
    ]),
  });
}

function assignUnmappedImages(
  session: SessionData,
  classifications: Array<{ type: string; rawText: string; processedBuffer: Buffer; origBuffer: Buffer; assigned: string }>
) {
  const missingSlots: string[] = [];
  if (!session._gotFront) missingSlots.push('front');
  if (!session._gotBack) missingSlots.push('back');
  if (!session._gotPortrait) missingSlots.push('portrait');

  for (const c of classifications) {
    if (!c.assigned) {
      const index = missingSlots.indexOf(c.type);
      if (index !== -1) {
        c.assigned = c.type;
        missingSlots.splice(index, 1);
      }
    }
  }

  for (const c of classifications) {
    if (!c.assigned && missingSlots.length > 0) {
      c.assigned = missingSlots.shift()!;
    }
  }
}

export function buildConversationScene(
  sessionService: SessionService,
  ocrService: OcrService,
  photoService: PhotoProcessorService,
  cardService: CardGeneratorService,
  bgTaskService: BackgroundTaskService,
  historyService: CardHistoryService,
): Scenes.WizardScene<BotContext> {

  const scene = new Scenes.WizardScene<BotContext>(
    'FAYDA_WIZARD',

    async (ctx) => {
      const userId = ctx.from!.id;
      const MAX_CONCURRENT = 5;

      const existingSession = sessionService.get(userId);
      if (!existingSession && sessionService.activeCount() >= MAX_CONCURRENT) {
        const prefLang = sessionService.getLangPref(userId) ?? 'en';
        await ctx.reply(T[prefLang].busy);
        return ctx.scene.leave();
      }

      bgTaskService.clear(userId);

      const prefLang = sessionService.getLangPref(userId);
      const prefTheme = sessionService.getThemePref(userId);

      if (prefLang) {
        sessionService.merge(userId, {
          step: ConversationStep.AWAIT_IMAGES,
          ocrAttempted: false,
          createdAt: new Date(),
          _collectedImages: [],
          lang: prefLang,
          theme: prefTheme,
          _gotFront: false,
          _gotBack: false,
          _gotPortrait: false,
        });
        await ctx.reply(`🇪🇹 *Fayda ID*\n\n${T[prefLang].guideCollect}`, { parse_mode: 'Markdown' });
        // Jump directly to image receiver step (step index 2)
        ctx.wizard.selectStep(2);
        return;
      }

      sessionService.merge(userId, {
        step: ConversationStep.WELCOME,
        ocrAttempted: false,
        createdAt: new Date(),
        _collectedImages: [],
        theme: prefTheme,
      });
      await ctx.reply(T.en.welcome, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('🇬🇧 English', 'lang_en'),
          Markup.button.callback('🇪🇹 አማርኛ', 'lang_am'),
        ]]),
      });
      return ctx.wizard.next();
    },

    async (ctx) => {
      const userId = ctx.from!.id;
      const cb = ctx.callbackQuery as { data?: string } | undefined;
      if (!cb?.data?.startsWith('lang_')) return;

      const lang: Lang = cb.data === 'lang_en' ? 'en' : 'am';
      sessionService.saveLangPref(userId, lang);

      sessionService.merge(userId, { 
        lang, 
        step: ConversationStep.AWAIT_IMAGES,
        _gotFront: false,
        _gotBack: false,
        _gotPortrait: false,
        _collectedImages: [],
      } as Partial<SessionData>);
      await ctx.answerCbQuery(T[lang].langSet);
      await ctx.reply(T[lang].guideCollect, { parse_mode: 'Markdown' });
      return ctx.wizard.next();
    },

    async (ctx) => {
      const userId = ctx.from!.id;
      const lang = getLang(sessionService, userId);
      const session = sessionService.get(userId)!;
      const bg = bgTaskService.get(userId);

      const imgBuffer = await downloadPhoto(ctx);
      if (!imgBuffer) return;

      if (!bg.classifications) bg.classifications = [];

      // Instantly start processing in background
      const processPromise = ocrService.quickClassify(imgBuffer).then((res) => ({ ...res, origBuffer: imgBuffer }));
      bg.classifications.push(processPromise);

      const count = bg.classifications.length;

      if (!session.statusMsgId) {
        const sentMsg = await ctx.reply(`📥 Received image ${count}/3...`);
        sessionService.merge(userId, { statusMsgId: sentMsg.message_id } as Partial<SessionData>);
      } else {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            session.statusMsgId,
            undefined,
            count < 3 ? `📥 Received image ${count}/3...` : `✅ All 3 images received! Processing extraction...`
          );
        } catch { /* Ignore telegram unchanged error */ }
      }

      if (count < 3) return;

      // We have all 3! Start final resolution in the background to avoid 90s Telegraf timeout
      Promise.all(bg.classifications).then(async (classificationResults) => {
        // Acquire mutex to serialize native addon operations (prevents heap corruption)
        const release = await nativeMutex.acquire();
        try {
          const leftovers: any[] = [];
          
          // Attempt assignments
          for (const res of classificationResults) {
            const s = sessionService.get(userId)!;
            if (res.type === 'front' && !s._gotFront) {
              sessionService.merge(userId, { _gotFront: true, _frontScreenshotBuffer: res.origBuffer } as Partial<SessionData>);
              bg.frontOcr = ocrService.extractFrontCard(res.processedBuffer, res.rawText).catch(() => ({}));
            } else if (res.type === 'back' && !s._gotBack) {
              sessionService.merge(userId, { _gotBack: true, _backScreenshotBuffer: res.origBuffer } as Partial<SessionData>);
              bg.backOcr = ocrService.extractBackCard(res.processedBuffer, res.rawText).catch(() => ({}));
              bg.qrData = ocrService.decodeQrData(res.origBuffer).catch(() => null);
            } else if (res.type === 'portrait' && !s._gotPortrait) {
              sessionService.merge(userId, { _gotPortrait: true, _portraitScreenshotBuffer: res.origBuffer } as Partial<SessionData>);
              bg.portrait = photoService.processPortrait(res.origBuffer).then(b => photoService.removeBackground(b)).catch(() => Buffer.alloc(0));
            } else {
              leftovers.push(res);
            }
          }

          // Assign leftover unknowns to missing slots
          const s2 = sessionService.get(userId)!;
          const missing: ('front' | 'back' | 'portrait')[] = [];
          if (!s2._gotFront) missing.push('front');
          if (!s2._gotBack) missing.push('back');
          if (!s2._gotPortrait) missing.push('portrait');

          for (let i = 0; i < leftovers.length && missing.length > 0; i++) {
            const u = leftovers[i];
            const assignTo = missing.shift()!;
            if (assignTo === 'front') {
              sessionService.merge(userId, { _gotFront: true, _frontScreenshotBuffer: u.origBuffer } as Partial<SessionData>);
              bg.frontOcr = ocrService.extractFrontCard(u.processedBuffer, u.rawText).catch(() => ({}));
            } else if (assignTo === 'back') {
              sessionService.merge(userId, { _gotBack: true, _backScreenshotBuffer: u.origBuffer } as Partial<SessionData>);
              bg.backOcr = ocrService.extractBackCard(u.processedBuffer, u.rawText).catch(() => ({}));
              bg.qrData = ocrService.decodeQrData(u.origBuffer).catch(() => null);
            } else if (assignTo === 'portrait') {
              sessionService.merge(userId, { _gotPortrait: true, _portraitScreenshotBuffer: u.origBuffer } as Partial<SessionData>);
              bg.portrait = photoService.processPortrait(u.origBuffer).then(b => photoService.removeBackground(b)).catch(() => Buffer.alloc(0));
            }
          }

          await showReviewDialog(ctx, userId, lang, sessionService, bgTaskService, cardService);
        } finally {
          release();
        }
      }).catch(err => {
        logger.error(`Background processing failed: ${err}`);
      });

      // Advance the wizard immediately so Telegram doesn't timeout!
      return ctx.wizard.next();
    },

    async (ctx) => {
      const userId = ctx.from!.id;
      const lang = getLang(sessionService, userId);
      const session = sessionService.get(userId)!;

      // Handle text inputs for field editing
      if (ctx.message && 'text' in ctx.message && session.editState === 'awaiting_value') {
        const text = ctx.message.text.trim();
        const field = session.editingField as keyof SessionData;

        if (field === 'fan') {
          const fanCheck = validateFan(text);
          if (!fanCheck.valid) {
            await ctx.reply(T[lang].invalidFan);
            return;
          }
        }

        if (field === 'fin') {
          const normalizedFin = text.replace(/\s+/g, ' ').toUpperCase();
          const finCheck = validateFin(normalizedFin);
          if (!finCheck.valid) {
            await ctx.reply(T[lang].invalidFin);
            return;
          }
        }

        sessionService.merge(userId, {
          [field]: field === 'fin' ? text.replace(/\s+/g, ' ').toUpperCase() : text,
          editState: 'menu',
          editingField: undefined,
        } as Partial<SessionData>);

        await showEditMenu(ctx, lang);
        return;
      }

      const cb = ctx.callbackQuery as { data?: string } | undefined;
      if (!cb?.data) return;

      if (cb.data.startsWith('edit_generated_')) {
        await ctx.answerCbQuery().catch(() => {});
        const cardId = Number(cb.data.replace('edit_generated_', ''));
        const record = historyService.getCardRecord(cardId);
        if (!record) {
          await ctx.reply(T[lang].generatedMissing);
          return;
        }

        sessionService.merge(userId, {
          ...record.data,
          generatedCardId: cardId,
          editState: undefined,
          editingField: undefined,
          step: ConversationStep.REVIEW,
          ocrAttempted: true,
          createdAt: new Date(),
          lang,
          theme: (record.data.theme as SessionData['theme']) ?? session.theme,
        } as Partial<SessionData>);

        const generatedSession = sessionService.get(userId)!;
        await showGeneratedCardReview(ctx, generatedSession, lang, cardId);
        return;
      }

      // --- EDIT MODE ACTIONS ---
      if (cb.data === 'edit_menu') {
        await ctx.answerCbQuery().catch(() => {});
        sessionService.merge(userId, { editState: 'menu' } as Partial<SessionData>);
        await showEditMenu(ctx, lang);
        return;
      }

      if (cb.data === 'edit_back') {
        await ctx.answerCbQuery().catch(() => {});
        sessionService.merge(userId, { editState: undefined, editingField: undefined } as Partial<SessionData>);
        const latest = sessionService.get(userId)!;
        if (latest.generatedCardId) {
          await showGeneratedCardReview(ctx, latest, lang, latest.generatedCardId);
        } else {
          await showReviewDialog(ctx, userId, lang, sessionService, bgTaskService, cardService);
        }
        return;
      }

      if (cb.data.startsWith('preset_')) {
        await ctx.answerCbQuery().catch(() => {});
        
        if (cb.data === 'preset_sex_m') {
          sessionService.merge(userId, { sexAmharic: 'ወንድ', sexEnglish: 'Male', editState: 'menu', editingField: undefined });
        } else if (cb.data === 'preset_sex_f') {
          sessionService.merge(userId, { sexAmharic: 'ሴት', sexEnglish: 'Female', editState: 'menu', editingField: undefined });
        } else if (cb.data === 'preset_nat_et') {
          sessionService.merge(userId, { 
            nationalityAmharic: 'ኢትዮጵያዊ', 
            nationalityEnglish: 'Ethiopian', 
            editState: 'menu', 
            editingField: undefined 
          });
        }
        
        await showEditMenu(ctx, lang);
        return;
      }

      if (cb.data.startsWith('edit_f_')) {
        await ctx.answerCbQuery().catch(() => {});
        const fieldKey = cb.data.replace('edit_f_', '');
        const fieldInfo = REVIEW_FIELDS.find(f => f.key === fieldKey);
        
        sessionService.merge(userId, { 
          editState: 'awaiting_value',
          editingField: fieldKey
        } as Partial<SessionData>);

        const prompt = T[lang].typeNewValue.replace('{field}', fieldInfo ? fieldInfo.label[lang] : fieldKey);
        
        let extraKeyboard: any[] = [];
        if (fieldKey === 'sexAmharic' || fieldKey === 'sexEnglish') {
          extraKeyboard = [
            [Markup.button.callback('ወንድ | Male', 'preset_sex_m')],
            [Markup.button.callback('ሴት | Female', 'preset_sex_f')]
          ];
        } else if (fieldKey === 'nationalityEnglish' || fieldKey === 'nationalityAmharic') {
          extraKeyboard = [
            [Markup.button.callback('🇪🇹 ኢትዮጵያዊ | Ethiopian', 'preset_nat_et')]
          ];
        }

        if (extraKeyboard.length > 0) {
          await ctx.reply(prompt, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(extraKeyboard) });
        } else {
          await ctx.reply(prompt, { parse_mode: 'Markdown' });
        }
        return;
      }
      // --- END EDIT MODE ACTIONS ---

      if (cb.data === 'resend_front') {
        await ctx.answerCbQuery().catch(() => {});
        bgTaskService.get(userId).frontOcr = undefined;
        sessionService.merge(userId, { step: ConversationStep.AWAIT_IMAGES, _gotFront: false, _collectedImages: [] });
        await ctx.reply(T[lang].guideResend.replace('{count}', '1'), { parse_mode: 'Markdown' });
        ctx.wizard.selectStep(2);
        return;
      }

      if (cb.data === 'resend_back') {
        await ctx.answerCbQuery().catch(() => {});
        bgTaskService.get(userId).backOcr = undefined;
        bgTaskService.get(userId).qrData = undefined;
        sessionService.merge(userId, { step: ConversationStep.AWAIT_IMAGES, _gotBack: false, _collectedImages: [] });
        await ctx.reply(T[lang].guideResend.replace('{count}', '1'), { parse_mode: 'Markdown' });
        ctx.wizard.selectStep(2);
        return;
      }

      if (cb.data === 'resend_portrait') {
        await ctx.answerCbQuery().catch(() => {});
        bgTaskService.get(userId).portrait = undefined;
        sessionService.merge(userId, { step: ConversationStep.AWAIT_IMAGES, _gotPortrait: false, _collectedImages: [] });
        await ctx.reply(T[lang].guideResend.replace('{count}', '1'), { parse_mode: 'Markdown' });
        ctx.wizard.selectStep(2);
        return;
      }

      if (cb.data === 'confirm_generated') {
        await ctx.answerCbQuery('✅').catch(() => {});
        const current = sessionService.get(userId);
        const cardId = current?.generatedCardId;
        if (!cardId) {
          await ctx.reply(T[lang].generatedMissing);
          return;
        }
        const portrait = historyService.getCardPortrait(cardId);
        if (!portrait || portrait.length === 0) {
          await ctx.reply(T[lang].error);
          return;
        }

        const updatedCard = await cardService.generateCombined(current, portrait);
        const updated = historyService.updateCard(cardId, updatedCard, current);
        if (!updated) {
          await ctx.reply(T[lang].generatedMissing);
          return;
        }

        await ctx.replyWithDocument({ source: updatedCard, filename: `fayda_id_${cardId}_updated.png` });
        await showGeneratedCardReview(ctx, current, lang, cardId);
        return;
      }

      if (cb.data !== 'confirm_all') return;

      const missingFields: string[] = [];
      if (!session.fin) missingFields.push('FIN');
      if (!session.nameEnglish && !session.nameAmharic) missingFields.push('Full Name');

      if (missingFields.length > 0) {
        await ctx.answerCbQuery('⚠️ Missing Required Fields!').catch(() => {});
        const missingText = missingFields.join(', ');
        const prompt = lang === 'am' 
          ? `⚠️ የካርድ ማዘጋጀት አልተቻለም! ያልተሟላ መረጃ፡ *${missingText}*\n\nእባክዎ ✏️ አርም የሚለውን ቁልፍ በመጫን መረጃውን በጽሁፍ ያስገቡ::`
          : `⚠️ Cannot generate card! Missing critical information: *${missingText}*\n\nPlease tap the ✏️ Edit button to manually provide these details.`;
        
        await ctx.reply(prompt, { parse_mode: 'Markdown' });
        await showReviewDialog(ctx, userId, lang, sessionService, bgTaskService, cardService);
        return;
      }

      await ctx.answerCbQuery('✅').catch(err => logger.warn(`Failed to answer confirm_all callback: ${err.message}`));
      await ctx.reply(T[lang].processing);

      try {
        let portrait = session.processedPortrait;
        let bg = bgTaskService.get(userId);
        
        if (!portrait || portrait.length === 0) {
            portrait = await (bg.portrait ?? Promise.resolve(Buffer.alloc(0)));
            sessionService.merge(userId, { processedPortrait: portrait } as Partial<SessionData>);
        }

        // Use pre-computed QR if available (was started during review)
        const precomputedQr = await (bg.qrImage ?? Promise.resolve(undefined));

        const combinedPng = await cardService.generateCombined(session, portrait, precomputedQr);

        const cardNumber = historyService.saveCard(combinedPng, session, portrait);

        await ctx.replyWithDocument({ source: combinedPng, filename: 'fayda_id.png' });
        await ctx.reply(T[lang].done.replace('{count}', String(cardNumber)), { parse_mode: 'Markdown' });
        await ctx.reply(
          lang === 'am'
            ? 'ካርዱ ተዘጋጅቷል። ከፈለጉ መረጃውን አስተካክለው እንደገና ማዘጋጀት ይችላሉ።'
            : 'Your card is ready. You can edit details and regenerate it anytime.',
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback(T[lang].editGeneratedBtn, `edit_generated_${cardNumber}`)],
            ]),
          },
        );

        bgTaskService.clear(userId);
        sessionService.delete(userId);
        logger.log(`[${userId}] DONE — leaving scene`);
        await ctx.scene.leave();
      } catch (err) {
        logger.error(`[${userId}] Failed: ${(err as Error).stack}`);
        await ctx.reply(T[lang].error);
        bgTaskService.clear(userId);
        sessionService.delete(userId);
        await ctx.scene.leave();
      }
    },
  );

  return scene;
}
