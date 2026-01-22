import { Bot, Context, InlineKeyboard, webhookCallback } from 'grammy'
import { randomUUID } from 'crypto'
import {
  getGroup,
  createGroup,
  upsertUser,
  createExpense,
  getGroupMembers,
} from './dynamodb'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from './bedrock'
import { downloadFile } from './telegram'
import { createTranslator, getLocaleFromLanguageCode } from './i18n'
import { config } from './config'

const BOT_TOKEN = config.TELEGRAM_BOT_TOKEN
const MINI_APP_URL = config.MINI_APP_URL

// Create bot instance
export const bot = new Bot(BOT_TOKEN)

// Helper to get translator for context
function getT(ctx: Context) {
  const locale = getLocaleFromLanguageCode(ctx.from?.language_code)
  return createTranslator(locale)
}

// Command handlers
bot.command('start', async (ctx) => {
  const t = getT(ctx)
  const chatType = ctx.chat?.type

  if (chatType === 'private') {
    // Private chat - show welcome with Mini App button
    const keyboard = new InlineKeyboard()
      .webApp(t('bot.welcome.openApp'), MINI_APP_URL)
      .row()
      .url('Add to Group', `https://t.me/${ctx.me.username}?startgroup=true`)

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
    // Group chat - show help
    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

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

bot.command('help', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

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

bot.command('balance', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.balance.title'), MINI_APP_URL)

  await ctx.reply(`📊 ${t('bot.balance.openApp')}`, {
    reply_markup: keyboard,
  })
})

bot.command('expenses', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.expenses.title'), MINI_APP_URL)

  await ctx.reply(`📝 ${t('bot.expenses.openApp')}`, {
    reply_markup: keyboard,
  })
})

bot.command('settle', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.settle.title'), MINI_APP_URL)

  await ctx.reply(`💸 ${t('bot.settle.openApp')}`, {
    reply_markup: keyboard,
  })
})

bot.command('add', async (ctx) => {
  const t = getT(ctx)

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

// Handle text messages (expense parsing)
bot.on('message:text', async (ctx) => {
  // Skip commands and private chats
  if (ctx.message.text.startsWith('/')) return
  if (ctx.chat.type === 'private') return

  const text = ctx.message.text.toLowerCase()

  // Check if message looks like an expense (multilingual patterns)
  const isExpenseMessage =
    text.includes('@fracti') ||
    // English patterns
    text.includes('paid') ||
    text.includes('spent') ||
    text.includes('bought') ||
    text.includes('split') ||
    // Russian patterns
    text.includes('заплатил') ||
    text.includes('заплатила') ||
    text.includes('потратил') ||
    text.includes('потратила') ||
    text.includes('купил') ||
    text.includes('купила') ||
    text.includes('раздели') ||
    /\d+\s*(ton|usd|eur|rub|руб|\$|€|₽)/i.test(ctx.message.text)

  if (!isExpenseMessage) return

  await handleExpenseMessage(ctx)
})

// Handle photo messages (receipt scanning)
bot.on('message:photo', async (ctx) => {
  if (ctx.chat.type === 'private') return

  await handlePhotoMessage(ctx)
})

async function handleExpenseMessage(ctx: Context): Promise<void> {
  const t = getT(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const text = ctx.message?.text

  if (!chatId || !user || !text) return

  const groupId = String(chatId)

  // Ensure group exists
  let group = await getGroup(groupId)
  if (!group) {
    group = await createGroup({
      id: groupId,
      chatId: groupId,
      title: ctx.chat?.type !== 'private' ? (ctx.chat as any).title || 'Group' : 'Private',
      createdAt: new Date().toISOString(),
      memberCount: 1,
    })
  }

  // Register user
  await upsertUser(groupId, {
    id: String(user.id),
    telegramId: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    username: user.username,
  })

  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.amount || parsed.amount <= 0 || parsed.confidence < 0.5) return

    const members = await getGroupMembers(groupId)
    const memberMap = new Map(members.map((m) => [m.username?.toLowerCase(), m]))

    // Resolve payer
    let payerId = String(user.id)
    let payerName = user.first_name

    if (parsed.payer) {
      const payerMember = memberMap.get(parsed.payer.toLowerCase().replace('@', ''))
      if (payerMember) {
        payerId = payerMember.id
        payerName = payerMember.name
      }
    }

    // Calculate splits
    let splits = members.map((m) => ({
      userId: m.id,
      userName: m.name,
      amount: parsed.amount / members.length,
    }))

    if (parsed.beneficiaries?.length) {
      const beneficiaryIds = new Set<string>([payerId])
      for (const name of parsed.beneficiaries) {
        const member = memberMap.get(name.toLowerCase().replace('@', ''))
        if (member) beneficiaryIds.add(member.id)
      }
      const splitAmount = parsed.amount / beneficiaryIds.size
      splits = Array.from(beneficiaryIds).map((id) => {
        const member = members.find((m) => m.id === id)
        return { userId: id, userName: member?.name || 'Unknown', amount: splitAmount }
      })
    }

    await createExpense({
      id: randomUUID(),
      groupId,
      payerId,
      payerName,
      amount: parsed.amount,
      description: parsed.description || 'Expense',
      splitType: 'equal',
      splits,
      createdAt: new Date().toISOString(),
    })

    const eachAmount = (parsed.amount / splits.length).toFixed(2)
    const splitText =
      splits.length > 1
        ? t('bot.expense.splitWays', { count: splits.length, each: eachAmount })
        : ''

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

    await ctx.reply(
      `✅ ${t('bot.expense.created', { description: parsed.description, amount: parsed.amount })}\n` +
        `${t('bot.expense.paidBy', { name: payerName })}\n${splitText}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message?.message_id || 0 },
      }
    )
  } catch (error) {
    console.error('Expense parse error:', error)
  }
}

async function handlePhotoMessage(ctx: Context): Promise<void> {
  const t = getT(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const photos = ctx.message?.photo

  if (!chatId || !user || !photos?.length) return

  const groupId = String(chatId)
  const photo = photos[photos.length - 1] // Get largest photo

  // Ensure group exists
  let group = await getGroup(groupId)
  if (!group) {
    group = await createGroup({
      id: groupId,
      chatId: groupId,
      title: ctx.chat?.type !== 'private' ? (ctx.chat as any).title || 'Group' : 'Private',
      createdAt: new Date().toISOString(),
      memberCount: 1,
    })
  }

  // Register user
  await upsertUser(groupId, {
    id: String(user.id),
    telegramId: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    username: user.username,
  })

  try {
    const imageBuffer = await downloadFile(photo.file_id)
    if (!imageBuffer) {
      await ctx.reply(`❌ ${t('bot.receipt.downloadError')}`, {
        reply_parameters: { message_id: ctx.message?.message_id || 0 },
      })
      return
    }

    await ctx.reply(`🔍 ${t('bot.receipt.scanning')}`, {
      reply_parameters: { message_id: ctx.message?.message_id || 0 },
    })

    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      imageBuffer.toString('base64'),
      'image/jpeg'
    )

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      await ctx.reply(`❌ ${t('bot.receipt.parseError')}`)
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.items?.length) {
      await ctx.reply(`❌ ${t('bot.receipt.noItems')}`)
      return
    }

    let summary = `🧾 ${t('bot.receipt.success', { merchant: parsed.merchant || 'Receipt' })}\n\n`
    for (const item of parsed.items.slice(0, 8)) {
      summary += `• ${item.name}: ${item.price} ${parsed.currency || ''}\n`
    }
    if (parsed.items.length > 8) {
      summary += `<i>...+${parsed.items.length - 8}</i>\n`
    }
    summary += `\n<b>${t('bot.receipt.total', { amount: parsed.total, currency: parsed.currency || '' })}</b>`

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
  } catch (error) {
    console.error('Receipt scan error:', error)
    await ctx.reply(`❌ ${t('bot.receipt.scanError')}`, {
      reply_parameters: { message_id: ctx.message?.message_id || 0 },
    })
  }
}

// Create webhook handler
export const handleUpdate = webhookCallback(bot, 'std/http')
