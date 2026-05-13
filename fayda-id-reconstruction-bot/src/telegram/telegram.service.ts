import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { SessionService } from '../session/session.service';
import { OcrService } from '../ocr/ocr.service';
import { PhotoProcessorService } from '../photo-processor/photo-processor.service';
import { CardGeneratorService } from '../card-generator/card-generator.service';
import { CardHistoryService } from '../history/card-history.service';
import { A4LayoutService } from '../card-generator/a4-layout.service';
import { BackgroundTaskService } from './background-task.service';
import { buildConversationScene } from './conversation.scene';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot!: Telegraf<Scenes.WizardContext>;

  constructor(
    private readonly sessionService: SessionService,
    private readonly ocrService: OcrService,
    private readonly photoService: PhotoProcessorService,
    private readonly cardService: CardGeneratorService,
    private readonly bgTaskService: BackgroundTaskService,
    private readonly historyService: CardHistoryService,
    private readonly a4LayoutService: A4LayoutService,
  ) {}

  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not set — bot will not start');
      return;
    }

    this.bot = new Telegraf<Scenes.WizardContext>(token);

    const wizardScene = buildConversationScene(
      this.sessionService,
      this.ocrService,
      this.photoService,
      this.cardService,
      this.bgTaskService,
      this.historyService,
    );

    const stage = new Scenes.Stage<Scenes.WizardContext>([wizardScene]);
    this.bot.use(session());
    this.bot.use(stage.middleware());

    this.bot.command('start', async (ctx) => {
      const userId = ctx.from.id;
      const existing = this.sessionService.get(userId);
      if (existing) {
        this.sessionService.delete(userId);
        await ctx.reply('Previous session cleared. Starting fresh...');
      }
      await ctx.scene.enter('FAYDA_WIZARD');
    });

    this.bot.command('cancel', async (ctx) => {
      const userId = ctx.from.id;
      this.sessionService.delete(userId);
      await ctx.scene.leave();
      await ctx.reply('❌ Session cancelled. Send /start to begin again.');
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '📋 Fayda ID Reconstruction Bot\n\n' +
          '/start — Begin a new ID card reconstruction\n' +
          '/lang — Change Language\n' +
          '/template — Change Card Color Theme\n' +
          '/cancel — Cancel the current session\n' +
          '/print — Admin: Print up to last 5 generated cards as an A4 sheet\n' +
          '/help — Show this message\n\n' +
          'Flow: send FRONT screenshot → BACK screenshot → PORTRAIT screenshot, review extracted data, then generate the final card.',
      );
    });

    this.bot.command('lang', async (ctx) => {
      await ctx.reply('Select Language / ቋንቋ ይምረጡ:', {
        ...Markup.inlineKeyboard([[
          Markup.button.callback('🇬🇧 English', 'global_lang_en'),
          Markup.button.callback('🇪🇹 አማርኛ', 'global_lang_am'),
        ]]),
      });
    });

    this.bot.action(/global_lang_(en|am)/, async (ctx) => {
      const match = ctx.match[1] as 'en' | 'am';
      this.sessionService.saveLangPref(ctx.from!.id, match);
      await ctx.answerCbQuery(match === 'en' ? '🇬🇧 English set' : '🇪🇹 አማርኛ ተመርጧል');
      await ctx.reply(match === 'en' ? '✅ Language updated. Send /start to begin.' : '✅ ቋንቋ ተስተካክሏል። ለመጀመር /start ይጫኑ።');
    });

    this.bot.command('template', async (ctx) => {
      await ctx.reply('Select Card Theme / የካርድ ገጽታ ይምረጡ:', {
        ...Markup.inlineKeyboard([[
          Markup.button.callback('🌅 Warm Theme (Default)', 'global_theme_warm'),
        ],
        [
          Markup.button.callback('💡 Bright Theme', 'global_theme_bright'),
        ]]),
      });
    });

    this.bot.action(/global_theme_(warm|bright)/, async (ctx) => {
      const theme = ctx.match[1] as 'warm' | 'bright';
      this.sessionService.saveThemePref(ctx.from!.id, theme);
      await ctx.answerCbQuery(theme === 'warm' ? '🌅 Warm Theme Set' : '💡 Bright Theme Set');
      await ctx.reply(`✅ Template changed to *${theme === 'warm' ? 'Warm' : 'Bright'}*. Send /start to use it!`, { parse_mode: 'Markdown' });
    });

    this.bot.command('print', async (ctx) => {
      const cards = this.historyService.getLastCards();
      if (cards.length === 0) {
        await ctx.reply('⚠️ No cards have been generated recently. Cannot print an empty layout.');
        return;
      }
      
      const msg = await ctx.reply(`⏳ Generating A4 mirrored sheet with ${cards.length} card(s)...`);
      try {
        const layoutBuffer = await this.a4LayoutService.generateA4Mirrored(cards);
        await ctx.replyWithDocument({ source: layoutBuffer, filename: 'print_a4_layout.png' });
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
        // Auto-reset counter and clear queue after successful print
        this.historyService.resetCounter();
        this.historyService.clearQueue();
        this.logger.log('Print successful — counter reset to 0, queue cleared');
      } catch (err) {
        this.logger.error(`A4 printing failed: ${(err as Error).message}`);
        await ctx.reply(`❌ Failed to generate A4 sheet: ${(err as Error).message}`);
      }
    });

    this.bot.command('reset', async (ctx) => {
      this.historyService.resetCounter();
      await ctx.reply('✅ Card counter reset to 0.');
    });

    this.bot.telegram.setMyCommands([
      { command: 'start', description: 'New Card' },
      { command: 'lang', description: 'Language' },
      { command: 'template', description: 'Template' },
      { command: 'print', description: 'Print A4' },
      { command: 'reset', description: 'Reset Counter' },
      { command: 'cancel', description: 'Cancel' },
      { command: 'help', description: 'Help' },
    ]).catch((err: Error) => {
      this.logger.error(`Failed to set Telegram menu commands: ${err.message}`);
    });

    this.bot.catch((err, ctx) => {
      this.logger.error(`Telegraf error for ${ctx.updateType}: ${(err as Error).message}`);
    });

    this.bot.launch().catch((err: Error) => {
      this.logger.error(`Bot launch failed: ${err.message}`);
    });

    this.logger.log('Telegram bot started (long-polling)');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      this.bot.stop('SIGTERM');
    }
  }
}
