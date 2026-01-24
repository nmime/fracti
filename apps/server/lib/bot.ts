import { Bot, Context, InlineKeyboard, webhookCallback } from 'grammy'
import type { Chat, User } from 'grammy/types'
import { randomUUID } from 'crypto'
import {
  getGroup,
  createGroup,
  upsertUser,
  getUser,
  createExpense,
  getGroupMembers,
} from './dynamodb'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from './bedrock'
import { downloadFile, downloadUserProfilePhoto } from './telegram'
import { uploadAvatar } from './s3'
import { createTranslator, getLocaleFromLanguageCode } from './i18n'
import { config } from './config'
import { logger } from './logger'
import { extractJSON } from './utils'

/**
 * Type guard to check if chat is a group/supergroup chat with a title
 */
function isGroupChat(chat: Chat): chat is Chat.GroupChat | Chat.SupergroupChat {
  return chat.type === 'group' || chat.type === 'supergroup'
}

/**
 * Safely get chat title, returns 'Group' for private chats or if title is unavailable
 */
function getChatTitle(chat: Chat | undefined): string {
  if (!chat) return 'Group'
  if (isGroupChat(chat)) {
    return chat.title
  }
  return 'Group'
}

const BOT_TOKEN = config.TELEGRAM_BOT_TOKEN
const MINI_APP_URL = config.MINI_APP_URL

// Create bot instance
export const bot = new Bot(BOT_TOKEN)

// Helper to get translator for context
function getT(ctx: Context) {
  const locale = getLocaleFromLanguageCode(ctx.from?.language_code)
  return createTranslator(locale)
}

/**
 * Register or update a user in the group, fetching their avatar if needed
 */
async function registerUserWithAvatar(
  groupId: string,
  user: User
): Promise<void> {
  const telegramId = user.id
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')

  // Check if user already exists and has an avatar
  const existingUser = await getUser(groupId, telegramId)

  let avatarUrl = existingUser?.avatarUrl

  // Fetch avatar if user doesn't have one yet
  if (!avatarUrl) {
    try {
      const photo = await downloadUserProfilePhoto(telegramId)
      if (photo) {
        avatarUrl = await uploadAvatar(telegramId, photo.buffer, photo.mimeType)
        logger.info('Uploaded user avatar', { telegramId, avatarUrl })
      }
    } catch (error) {
      logger.warn('Failed to fetch/upload avatar', { telegramId }, error)
      // Continue without avatar - not critical
    }
  }

  // Upsert user with avatar
  await upsertUser(groupId, {
    id: String(telegramId),
    telegramId,
    name,
    username: user.username,
    avatarUrl,
  })
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
      .url(t('bot.welcome.addToGroup'), `https://t.me/${ctx.me.username}?startgroup=true`)

    await ctx.reply(
      `👋 ${t('bot.welcome.private')}\n\n` +
        `${t('bot.welcome.privateDescription')}\n\n` +
        `<b>${t('bot.welcome.howToUse')}</b>\n` +
        `${t('bot.welcome.howToStep1')}\n` +
        `${t('bot.welcome.howToStep2')}\n` +
        `${t('bot.welcome.howToStep3')}\n` +
        `${t('bot.welcome.howToStep4')}\n\n` +
        `📱 ${t('bot.welcome.getStarted')}`,
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
        `<b>${t('bot.welcome.quickStart')}</b>\n` +
        `• ${t('bot.welcome.quickExample')}\n` +
        `• ${t('bot.welcome.quickReceipt')}\n` +
        `• ${t('bot.welcome.quickBalance')}\n` +
        `• ${t('bot.welcome.quickHelp')}`,
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

// Handle ALL text messages - register users and parse expenses when mentioned
bot.on('message:text', async (ctx) => {
  // Skip commands and private chats
  if (ctx.message.text.startsWith('/')) return
  if (ctx.chat.type === 'private') return

  const chatId = ctx.chat?.id
  const user = ctx.from
  if (!chatId || !user) return

  const groupId = String(chatId)

  // Always ensure group exists
  let group = await getGroup(groupId)
  if (!group) {
    group = await createGroup({
      id: groupId,
      chatId: groupId,
      title: getChatTitle(ctx.chat),
      createdAt: new Date().toISOString(),
      memberCount: 1,
    })
  }

  // Register user with avatar from every message (capture ALL users)
  await registerUserWithAvatar(groupId, user)

  // Only process expense via AI when bot is @mentioned
  const botUsername = ctx.me.username.toLowerCase()
  const text = ctx.message.text.toLowerCase()
  const isBotMentioned = text.includes(`@${botUsername}`)

  if (!isBotMentioned) return

  await handleExpenseMessage(ctx)
})

// Handle photo messages (receipt scanning)
bot.on('message:photo', async (ctx) => {
  if (ctx.chat.type === 'private') return

  const chatId = ctx.chat?.id
  const user = ctx.from
  if (!chatId || !user) return

  const groupId = String(chatId)

  // Always ensure group exists
  let group = await getGroup(groupId)
  if (!group) {
    group = await createGroup({
      id: groupId,
      chatId: groupId,
      title: getChatTitle(ctx.chat),
      createdAt: new Date().toISOString(),
      memberCount: 1,
    })
  }

  // Register user with avatar from every message (capture ALL users)
  await registerUserWithAvatar(groupId, user)

  await handlePhotoMessage(ctx)
})

async function handleExpenseMessage(ctx: Context): Promise<void> {
  const t = getT(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const text = ctx.message?.text

  if (!chatId || !user || !text) return

  const groupId = String(chatId)

  // Get group for the title (already created in main message handler)
  const group = await getGroup(groupId)
  if (!group) return

  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, text)

    // Extract and validate JSON from AI response
    const parsed = extractJSON<{
      payer?: string
      amount?: number
      description?: string
      beneficiaries?: string[]
      confidence?: number
    }>(response)

    if (!parsed || !parsed.amount || parsed.amount <= 0 || (parsed.confidence ?? 0) < 0.5) return

    // Extract amount after validation (TypeScript narrowing)
    const expenseAmount = parsed.amount

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
      amount: expenseAmount / members.length,
    }))

    if (parsed.beneficiaries?.length) {
      const beneficiaryIds = new Set<string>([payerId])
      for (const name of parsed.beneficiaries) {
        const member = memberMap.get(name.toLowerCase().replace('@', ''))
        if (member) beneficiaryIds.add(member.id)
      }
      const splitAmount = expenseAmount / beneficiaryIds.size
      splits = Array.from(beneficiaryIds).map((id) => {
        const member = members.find((m) => m.id === id)
        return { userId: id, userName: member?.name || 'Unknown', amount: splitAmount }
      })
    }

    await createExpense({
      id: randomUUID(),
      groupId,
      groupTitle: group.title,
      payerId,
      payerName,
      amount: expenseAmount,
      currency: group.currency,
      description: parsed.description || 'Expense',
      splitType: 'equal',
      splits,
      createdAt: new Date().toISOString(),
    })

    const eachAmount = (expenseAmount / splits.length).toFixed(2)
    const splitText =
      splits.length > 1
        ? t('bot.expense.splitWays', { count: splits.length, each: eachAmount })
        : ''

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

    const description = parsed.description || 'Expense'
    await ctx.reply(
      `✅ ${t('bot.expense.created', { description, amount: expenseAmount })}\n` +
        `${t('bot.expense.paidBy', { name: payerName })}\n${splitText}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
      }
    )
  } catch (error) {
    logger.error('Expense parse error', { groupId, userId: user.id }, error)
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

  // Group and user are already registered in the main photo handler

  try {
    const imageBuffer = await downloadFile(photo.file_id)
    if (!imageBuffer) {
      await ctx.reply(`❌ ${t('bot.receipt.downloadError')}`, {
        reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
      })
      return
    }

    await ctx.reply(`🔍 ${t('bot.receipt.scanning')}`, {
      reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
    })

    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      imageBuffer.toString('base64'),
      'image/jpeg'
    )

    // Extract and validate JSON from AI response
    const parsed = extractJSON<{
      merchant?: string
      items?: Array<{ name: string; price: number }>
      total?: number
      currency?: string
    }>(response)

    if (!parsed) {
      await ctx.reply(`❌ ${t('bot.receipt.parseError')}`)
      return
    }

    if (!parsed.items?.length) {
      await ctx.reply(`❌ ${t('bot.receipt.noItems')}`)
      return
    }

    // Calculate total from items if not provided
    const receiptTotal = parsed.total ?? parsed.items.reduce((sum, item) => sum + item.price, 0)

    let summary = `🧾 ${t('bot.receipt.success', { merchant: parsed.merchant || 'Receipt' })}\n\n`
    for (const item of parsed.items.slice(0, 8)) {
      summary += `• ${item.name}: ${item.price} ${parsed.currency ?? ''}\n`
    }
    if (parsed.items.length > 8) {
      summary += `<i>...+${parsed.items.length - 8}</i>\n`
    }
    summary += `\n<b>${t('bot.receipt.total', { amount: receiptTotal, currency: parsed.currency ?? '' })}</b>`

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), MINI_APP_URL)

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
  } catch (error) {
    logger.error('Receipt scan error', { groupId, userId: user.id }, error)
    await ctx.reply(`❌ ${t('bot.receipt.scanError')}`, {
      reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
    })
  }
}

// ============================================
// Inline Mode Support
// ============================================

/**
 * Handle inline queries for quick expense sharing
 * Users can type @BotName <amount> <description> in any chat
 */
bot.on('inline_query', async (ctx) => {
  const t = getT(ctx)
  const query = ctx.inlineQuery.query.trim()
  const userId = ctx.from.id

  // Parse query: "50 dinner" or "100.50 groceries"
  const match = query.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)

  const results = []

  if (match) {
    const amount = parseFloat(match[1])
    const description = match[2] || t('bot.expense.created', { description: '', amount: '' }).split(':')[0].trim()

    // Get user's groups for suggestions
    const memberships = await getGroupsByUser(userId)

    if (memberships.length > 0) {
      // Add a result for each group
      for (const membership of memberships.slice(0, 10)) {
        const groupId = membership.GSI1SK?.replace('GROUP#', '') || ''
        const group = await getGroup(groupId)
        if (!group) continue

        results.push({
          type: 'article' as const,
          id: `expense-${groupId}-${Date.now()}`,
          title: `💸 ${amount} - ${description}`,
          description: t('bot.inline.addTo', { group: group.title }),
          thumbnail_url: 'https://i.imgur.com/YourIcon.png', // Replace with actual icon
          input_message_content: {
            message_text: `💸 <b>${t('bot.inline.newExpense')}</b>\n\n` +
              `${t('bot.inline.amount')}: <b>${amount} ${group.currency ?? 'TON'}</b>\n` +
              `${t('bot.inline.description')}: ${description}\n` +
              `${t('bot.inline.group')}: ${group.title}\n\n` +
              `<i>${t('bot.inline.confirmPrompt')}</i>`,
            parse_mode: 'HTML' as const,
          },
          reply_markup: {
            inline_keyboard: [[
              { text: `✅ ${t('bot.inline.addExpense')}`, web_app: { url: `${MINI_APP_URL}?group=${groupId}&amount=${amount}&desc=${encodeURIComponent(description)}` } }
            ]]
          },
        })
      }
    }

    // Always add a "create new" option
    results.push({
      type: 'article' as const,
      id: `expense-new-${Date.now()}`,
      title: `💸 ${amount} - ${description}`,
      description: t('bot.inline.shareDetails'),
      input_message_content: {
        message_text: `💸 <b>${t('bot.inline.expenseToSplit')}</b>\n\n` +
          `${t('bot.inline.amount')}: <b>${amount}</b>\n` +
          `${t('bot.inline.description')}: ${description}\n\n` +
          `<i>${t('bot.inline.addToGroupPrompt')}</i>`,
        parse_mode: 'HTML' as const,
      },
    })
  } else if (query.length === 0) {
    // Show help when query is empty
    results.push({
      type: 'article' as const,
      id: 'help',
      title: `💡 ${t('bot.inline.howToUseTitle')}`,
      description: t('bot.inline.howToUseDescription'),
      input_message_content: {
        message_text: `💡 <b>${t('bot.inline.inlineModeTitle')}</b>\n\n` +
          `${t('bot.inline.typeExample', { botUsername: ctx.me.username })}\n\n` +
          `${t('bot.inline.quickSharePrompt')}`,
        parse_mode: 'HTML' as const,
      },
    })
  }

  await ctx.answerInlineQuery(results, {
    cache_time: 10,
    is_personal: true,
  })
})

/**
 * Handle chosen inline result (when user selects a result)
 */
bot.on('chosen_inline_result', async (ctx) => {
  const resultId = ctx.chosenInlineResult.result_id
  const userId = ctx.from.id

  logger.info('Inline result chosen', {
    userId,
    resultId,
    query: ctx.chosenInlineResult.query,
  })
})

// Import for inline mode
import { getGroupsByUser } from './dynamodb'

// Create webhook handler
export const handleUpdate = webhookCallback(bot, 'std/http')
