import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { extractJSON } from '@core/tools'
import { getGroup, createGroup, getGroupMembers } from '@core/db'
import { getTranslator } from '../i18n'
import { getMiniAppUrl, isWebAppUrl } from '../config'
import { downloadFile } from '../integrations/telegram'
import { invokeClaudeText, invokeClaudeVision } from '../integrations/bedrock'
import {
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from '../services/ai.service'
import {
  getChatTitle,
  registerUserWithAvatar,
} from '../services/user.service'
import {
  createExpenseFromParsed,
  findPayerFromMembers,
} from '../services/expense.service'

/**
 * Message handlers for the Telegram bot
 */

// Helper to create a Mini App button with the correct type
function addMiniAppButton(keyboard: InlineKeyboard, text: string, url: string = getMiniAppUrl()): InlineKeyboard {
  if (isWebAppUrl(url)) {
    return keyboard.webApp(text, url)
  }
  return keyboard.url(text, url)
}

async function handleExpenseMessage(ctx: Context): Promise<void> {
  const t = getTranslator(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const text = ctx.message?.text

  if (!chatId || !user || !text) return

  const groupId = String(chatId)
  const group = await getGroup(groupId)
  if (!group) return

  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, text)

    const parsed = extractJSON<{
      payer?: string
      amount?: number
      description?: string
      beneficiaries?: string[]
      confidence?: number
    }>(response)

    if (!parsed || !parsed.amount || parsed.amount <= 0 || (parsed.confidence ?? 0) < 0.5) return

    const members = await getGroupMembers(groupId)
    const { payerId, payerName } = findPayerFromMembers(
      parsed.payer,
      members,
      String(user.id),
      user.first_name
    )

    const { splits } = await createExpenseFromParsed({
      groupId,
      group,
      payerId,
      payerName,
      amount: parsed.amount,
      description: parsed.description || 'Expense',
      beneficiaries: parsed.beneficiaries,
    })

    const eachAmount = (parsed.amount / splits.length).toFixed(2)
    const splitText = splits.length > 1
      ? t('bot.expense.splitWays', { count: splits.length, each: eachAmount })
      : ''

    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.welcome.openApp'))
    const description = parsed.description || 'Expense'

    await ctx.reply(
      `✅ ${t('bot.expense.created', { description, amount: parsed.amount })}\n` +
        `${t('bot.expense.paidBy', { name: payerName })}\n${splitText}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
      }
    )
  } catch {
    // Silent fail for expense parsing
  }
}

async function handlePhotoMessage(ctx: Context): Promise<void> {
  const t = getTranslator(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const photos = ctx.message?.photo

  if (!chatId || !user || !photos?.length) return

  const photo = photos[photos.length - 1]

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

    const receiptTotal = parsed.total ?? parsed.items.reduce((sum, item) => sum + item.price, 0)

    let summary = `🧾 ${t('bot.receipt.success', { merchant: parsed.merchant || 'Receipt' })}\n\n`
    for (const item of parsed.items.slice(0, 8)) {
      summary += `• ${item.name}: ${item.price} ${parsed.currency ?? ''}\n`
    }
    if (parsed.items.length > 8) {
      summary += `<i>...+${parsed.items.length - 8}</i>\n`
    }
    summary += `\n<b>${t('bot.receipt.total', { amount: receiptTotal, currency: parsed.currency ?? '' })}</b>`

    const keyboard = new InlineKeyboard()
    addMiniAppButton(keyboard, t('bot.welcome.openApp'))

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
  } catch {
    await ctx.reply(`❌ ${t('bot.receipt.scanError')}`, {
      reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
    })
  }
}

export function registerMessageHandlers(bot: Bot): void {
  // Handle text messages
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return
    if (ctx.chat.type === 'private') return

    const chatId = ctx.chat?.id
    const user = ctx.from
    if (!chatId || !user) return

    const groupId = String(chatId)

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

    await registerUserWithAvatar(groupId, user)

    const botUsername = ctx.me.username.toLowerCase()
    const text = ctx.message.text.toLowerCase()
    const isBotMentioned = text.includes(`@${botUsername}`)

    if (!isBotMentioned) return

    await handleExpenseMessage(ctx)
  })

  // Handle photo messages
  bot.on('message:photo', async (ctx) => {
    if (ctx.chat.type === 'private') return

    const chatId = ctx.chat?.id
    const user = ctx.from
    if (!chatId || !user) return

    const groupId = String(chatId)

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

    await registerUserWithAvatar(groupId, user)
    await handlePhotoMessage(ctx)
  })
}
