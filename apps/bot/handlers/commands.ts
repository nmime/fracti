import type { Bot } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { getTranslator } from '../i18n'
import { getMiniAppUrl, isWebAppUrl } from '../lib/config'

// Helper to create a Mini App button with the correct type
// Uses webApp button if URL is a proper HTTPS URL, otherwise falls back to url button
function addMiniAppButton(keyboard: InlineKeyboard, text: string, url: string = getMiniAppUrl()): InlineKeyboard {
  if (isWebAppUrl(url)) {
    return keyboard.webApp(text, url)
  }
  // For t.me links, use a regular URL button
  return keyboard.url(text, url)
}

export function registerCommandHandlers(bot: Bot): void {
  // Command: /start
  bot.command('start', async (ctx) => {
    console.log('/start command triggered, chat type:', ctx.chat?.type)
    const t = getTranslator(ctx)
    const chatType = ctx.chat?.type

    if (chatType === 'private') {
      const keyboard = new InlineKeyboard()
      addMiniAppButton(keyboard, t('bot.welcome.openApp'))
      keyboard.row().url('Add to Group', `https://t.me/${ctx.me.username}?startgroup=true`)

      await ctx.reply(
        `👋 ${t('bot.welcome.private')}\n\n` +
          `${t('bot.welcome.privateDescription')}\n\n` +
          '<b>How to use:</b>\n' +
          '1. Add me to a group chat\n' +
          '2. Send messages like "I paid 50 for dinner"\n' +
          '3. Or send receipt photos to scan\n' +
          '4. Open the Mini App to view balances and settle up\n\n' +
          '📱 Click below to get started!',
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      )
    } else {
      const keyboard = new InlineKeyboard()
      addMiniAppButton(keyboard, t('bot.welcome.openApp'))

      await ctx.reply(
        `💰 ${t('bot.welcome.group')}\n\n` +
          `${t('bot.welcome.groupDescription')}\n\n` +
          '<b>Quick start:</b>\n' +
          '• "I paid 50 for dinner with @alice"\n' +
          '• Send a receipt photo\n' +
          '• /balance - View balances\n' +
          '• /help - More commands',
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      )
    }
  })

  // Command: /help
  bot.command('help', async (ctx) => {
    const t = getTranslator(ctx)
    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.welcome.openApp'))

    await ctx.reply(
      `💰 ${t('bot.help.title')}\n\n` +
        `${t('bot.help.balance')}\n` +
        `${t('bot.help.expenses')}\n` +
        `${t('bot.help.settle')}\n` +
        `${t('bot.help.add')}\n\n` +
        `${t('bot.help.automatic')}\n` +
        `${t('bot.help.example1')}\n` +
        `${t('bot.help.example2')}\n` +
        `${t('bot.help.example3')}\n\n` +
        `📱 ${t('bot.help.openAppCta')}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }
    )
  })

  // Command: /balance
  bot.command('balance', async (ctx) => {
    const t = getTranslator(ctx)
    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.balance.title'))
    await ctx.reply(`📊 ${t('bot.balance.openApp')}`, { reply_markup: keyboard })
  })

  // Command: /expenses
  bot.command('expenses', async (ctx) => {
    const t = getTranslator(ctx)
    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.expenses.title'))
    await ctx.reply(`📝 ${t('bot.expenses.openApp')}`, { reply_markup: keyboard })
  })

  // Command: /settle
  bot.command('settle', async (ctx) => {
    const t = getTranslator(ctx)
    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.settle.title'))
    await ctx.reply(`💸 ${t('bot.settle.openApp')}`, { reply_markup: keyboard })
  })

  // Command: /add
  bot.command('add', async (ctx) => {
    const t = getTranslator(ctx)
    await ctx.reply(
      `➕ ${t('bot.add.title')}\n\n` +
        `${t('bot.add.description')}\n\n` +
        `${t('bot.add.examples')}\n` +
        `${t('bot.add.example1')}\n` +
        `${t('bot.add.example2')}\n` +
        `${t('bot.add.example3')}\n\n` +
        `${t('bot.add.tip')}`,
      { parse_mode: 'HTML' }
    )
  })
}
