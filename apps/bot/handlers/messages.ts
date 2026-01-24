import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { randomUUID } from 'crypto'
import {
  getGroup,
  createGroup,
  createExpense,
  getGroupMembers,
} from '@core/db'
import { extractJSON } from '@core/tools'
import { getTranslator } from '../i18n'
import { getMiniAppUrl } from '../lib/config'
import { getChatTitle, registerUserWithAvatar } from '../lib/helpers'
import { downloadFile } from '../middleware'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from '../ai'

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

    const expenseAmount = parsed.amount
    const members = await getGroupMembers(groupId)
    const memberMap = new Map(members.map((m) => [m.username?.toLowerCase(), m]))

    let payerId = String(user.id)
    let payerName = user.first_name

    if (parsed.payer) {
      const payerMember = memberMap.get(parsed.payer.toLowerCase().replace('@', ''))
      if (payerMember) {
        payerId = payerMember.id
        payerName = payerMember.name
      }
    }

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
    const splitText = splits.length > 1
      ? t('bot.expense.splitWays', { count: splits.length, each: eachAmount })
      : ''

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), getMiniAppUrl())
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

    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), getMiniAppUrl())

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
