import { setUserLanguage } from '@libs/db';
import { InlineKeyboard } from 'grammy';
import { getAppUrl, getMiniAppUrl, hasAppUrl } from '../config';
import { getTranslatorAsync, createTranslator, type Locale } from '../i18n';
import type { Bot, Context } from 'grammy';

// Helper to create a Mini App button with the correct type
// - Private chats: Use webApp button with APP_URL (CloudFront) if available, else URL button with MINI_APP_URL
// - Groups: Use URL button with MINI_APP_URL (t.me deeplink)
function addMiniAppButton(keyboard: InlineKeyboard, text: string, isPrivateChat: boolean): InlineKeyboard {
  if (isPrivateChat && hasAppUrl()) {
    // Private chats with CloudFront URL: use webApp button
    return keyboard.webApp(text, getAppUrl());
  }

  // Groups or no APP_URL: use URL button with t.me deeplink
  return keyboard.url(text, getMiniAppUrl());
}

export function registerCommandHandlers(bot: Bot): void {
  // Command: /start
  bot.command('start', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const chatType = ctx.chat?.type;
    const isPrivate = chatType === 'private';

    if (isPrivate) {
      const keyboard = new InlineKeyboard();
      addMiniAppButton(keyboard, t('bot.welcome.openApp'), true);
      keyboard.row().url(t('bot.welcome.addToGroup'), `https://t.me/${ctx.me.username}?startgroup=true`);

      await ctx.reply(
        `👋 ${t('bot.welcome.private')}\n\n` +
          `${t('bot.welcome.privateDescription')}\n\n` +
          `${t('bot.welcome.howToUse')}\n` +
          `${t('bot.welcome.step1')}\n` +
          `${t('bot.welcome.step2', { bot: ctx.me.username })}\n` +
          `${t('bot.welcome.step3')}\n` +
          `${t('bot.welcome.step4')}\n\n` +
          `📱 ${t('bot.welcome.getStarted')}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        },
      );
    } else {
      // Group/user registration is handled by message handler (messages.ts)
      const keyboard = new InlineKeyboard();
      addMiniAppButton(keyboard, t('bot.welcome.openApp'), false);

      const botUsername = ctx.me.username;
      await ctx.reply(
        `💰 ${t('bot.welcome.group')}\n\n` +
          `${t('bot.welcome.groupDescription')}\n\n` +
          `${t('bot.help.automatic')}\n` +
          `${t('bot.help.example1', { bot: botUsername })}\n` +
          `${t('bot.help.example2', { bot: botUsername })}\n${ 
          t('bot.help.example3')}`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        },
      );
    }
  });

  // Command: /help
  bot.command('help', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const isPrivate = ctx.chat?.type === 'private';
    const botUsername = ctx.me.username;
    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.welcome.openApp'), isPrivate);

    await ctx.reply(
      `💰 ${t('bot.help.title')}\n\n` +
        `${t('bot.help.balance')}\n` +
        `${t('bot.help.expenses')}\n` +
        `${t('bot.help.settle')}\n` +
        `${t('bot.help.add')}\n\n` +
        `${t('bot.help.automatic')}\n` +
        `${t('bot.help.example1', { bot: botUsername })}\n` +
        `${t('bot.help.example2', { bot: botUsername })}\n` +
        `${t('bot.help.example3')}\n\n` +
        `📱 ${t('bot.help.openAppCta')}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      },
    );
  });

  // Command: /balance
  bot.command('balance', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const isPrivate = ctx.chat?.type === 'private';
    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.balance.title'), isPrivate);
    await ctx.reply(`📊 ${t('bot.balance.openApp')}`, { reply_markup: keyboard });
  });

  // Command: /expenses
  bot.command('expenses', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const isPrivate = ctx.chat?.type === 'private';
    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.expenses.title'), isPrivate);
    await ctx.reply(`📝 ${t('bot.expenses.openApp')}`, { reply_markup: keyboard });
  });

  // Command: /settle
  bot.command('settle', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const isPrivate = ctx.chat?.type === 'private';
    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.settle.title'), isPrivate);
    await ctx.reply(`💸 ${t('bot.settle.openApp')}`, { reply_markup: keyboard });
  });

  // Command: /add
  bot.command('add', async (ctx) => {
    const t = await getTranslatorAsync(ctx);
    const botUsername = ctx.me.username;
    await ctx.reply(
      `➕ ${t('bot.add.title')}\n\n` +
        `${t('bot.add.description')}\n\n` +
        `${t('bot.add.examples')}\n` +
        `${t('bot.add.example1', { bot: botUsername })}\n` +
        `${t('bot.add.example2', { bot: botUsername })}\n` +
        `${t('bot.add.example3', { bot: botUsername })}\n\n${t('bot.add.tip')}`,
      { parse_mode: 'HTML' },
    );
  });

  // Command: /lang and /language - Change language (private chat only)
  const handleLanguageCommand = async (ctx: Context) => {
    const isPrivate = ctx.chat?.type === 'private';
    const telegramId = ctx.from?.id;

    if (!isPrivate) {
      const t = await getTranslatorAsync(ctx);
      await ctx.reply(t('bot.lang.privateOnly'));

      return;
    }

    if (!telegramId) return;

    const t = await getTranslatorAsync(ctx);

    // Create inline keyboard with language options
    const keyboard = new InlineKeyboard()
      .text('🇬🇧 English', 'lang:en')
      .text('🇷🇺 Русский', 'lang:ru');

    await ctx.reply(
      `🌐 ${t('bot.lang.title')}\n\n${t('bot.lang.description')}`,
      { reply_markup: keyboard },
    );
  };

  bot.command('lang', handleLanguageCommand);
  bot.command('language', handleLanguageCommand);

  // Callback query handler for language selection
  bot.callbackQuery(/^lang:(en|ru)$/, async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const match = ctx.callbackQuery.data.match(/^lang:(en|ru)$/);
    if (!match) return;

    const newLang = match[1] as Locale;

    // Save to database
    await setUserLanguage(telegramId, newLang);

    // Get translator with new language
    const t = createTranslator(newLang);

    await ctx.answerCallbackQuery({
      text: t('bot.lang.changed'),
    });

    // Update the message to show the new language is selected
    const langLabel = newLang === 'en' ? '🇬🇧 English' : '🇷🇺 Русский';
    await ctx.editMessageText(
      `🌐 ${t('bot.lang.title')}\n\n✅ ${t('bot.lang.current', { language: langLabel })}`,
    );
  });
}
