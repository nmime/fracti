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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/FractiBot/app'

// Create bot instance
export const bot = new Bot(BOT_TOKEN)

// Command handlers
bot.command('start', async (ctx) => {
  const chatType = ctx.chat?.type

  if (chatType === 'private') {
    // Private chat - show welcome with Mini App button
    const keyboard = new InlineKeyboard()
      .webApp('Open Fracti', MINI_APP_URL)
      .row()
      .url('Add to Group', `https://t.me/${ctx.me.username}?startgroup=true`)

    await ctx.reply(
      '👋 Welcome to <b>Fracti</b>!\n\n' +
        'I help groups track and split expenses with AI-powered parsing and on-chain settlements via TON.\n\n' +
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
    const keyboard = new InlineKeyboard().webApp('Open Fracti', MINI_APP_URL)

    await ctx.reply(
      '💰 <b>Fracti is ready!</b>\n\n' +
        'I can now track expenses in this group.\n\n' +
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
  const keyboard = new InlineKeyboard().webApp('Open Mini App', MINI_APP_URL)

  await ctx.reply(
    '💰 <b>Fracti Commands</b>\n\n' +
      '/balance - View balances\n' +
      '/expenses - Recent expenses\n' +
      '/settle - Settlement suggestions\n' +
      '/add - How to add expenses\n\n' +
      '<b>Automatic parsing:</b>\n' +
      '• "I paid 50 for dinner with @alice"\n' +
      '• Send a receipt photo\n\n' +
      '📱 Open the Mini App for full features!',
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }
  )
})

bot.command('balance', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('View Balances', MINI_APP_URL)

  await ctx.reply('📊 Open the Mini App to view detailed balances and the debt graph!', {
    reply_markup: keyboard,
  })
})

bot.command('expenses', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('View Expenses', MINI_APP_URL)

  await ctx.reply('📝 Open the Mini App to view all expenses!', {
    reply_markup: keyboard,
  })
})

bot.command('settle', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('Settle Up', MINI_APP_URL)

  await ctx.reply('💸 Open the Mini App to settle up with TON!', {
    reply_markup: keyboard,
  })
})

bot.command('add', async (ctx) => {
  await ctx.reply(
    '➕ <b>Adding expenses</b>\n\n' +
      'Just describe the expense naturally:\n' +
      '• "I paid 50 for dinner"\n' +
      '• "Bought groceries for 30, split with @alice @bob"\n' +
      '• Send a receipt photo!\n\n' +
      "I'll parse it automatically with AI.",
    { parse_mode: 'HTML' }
  )
})

// Handle text messages (expense parsing)
bot.on('message:text', async (ctx) => {
  // Skip commands and private chats
  if (ctx.message.text.startsWith('/')) return
  if (ctx.chat.type === 'private') return

  const text = ctx.message.text.toLowerCase()

  // Check if message looks like an expense
  const isExpenseMessage =
    text.includes('@fracti') ||
    text.includes('paid') ||
    text.includes('spent') ||
    text.includes('bought') ||
    text.includes('split') ||
    /\d+\s*(ton|usd|eur|\$|€)/i.test(ctx.message.text)

  if (!isExpenseMessage) return

  await handleExpenseMessage(ctx)
})

// Handle photo messages (receipt scanning)
bot.on('message:photo', async (ctx) => {
  if (ctx.chat.type === 'private') return

  await handlePhotoMessage(ctx)
})

async function handleExpenseMessage(ctx: Context): Promise<void> {
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

    const splitText =
      splits.length > 1
        ? `Split ${splits.length} ways (${(parsed.amount / splits.length).toFixed(2)} each)`
        : ''

    const keyboard = new InlineKeyboard().webApp('View Details', MINI_APP_URL)

    await ctx.reply(
      `✅ <b>${parsed.description}</b>: ${parsed.amount} TON\n` +
        `Paid by ${payerName}\n${splitText}`,
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
      await ctx.reply('❌ Failed to download image', {
        reply_parameters: { message_id: ctx.message?.message_id || 0 },
      })
      return
    }

    await ctx.reply('🔍 Scanning receipt...', {
      reply_parameters: { message_id: ctx.message?.message_id || 0 },
    })

    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      imageBuffer.toString('base64'),
      'image/jpeg'
    )

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      await ctx.reply('❌ Could not read receipt. Try a clearer photo.')
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.items?.length) {
      await ctx.reply('❌ No items found in receipt.')
      return
    }

    let summary = `🧾 <b>${parsed.merchant || 'Receipt'}</b>\n\n`
    for (const item of parsed.items.slice(0, 8)) {
      summary += `• ${item.name}: ${item.price} ${parsed.currency || ''}\n`
    }
    if (parsed.items.length > 8) {
      summary += `<i>...and ${parsed.items.length - 8} more items</i>\n`
    }
    summary += `\n<b>Total: ${parsed.total} ${parsed.currency || ''}</b>`

    const keyboard = new InlineKeyboard().webApp('Split This Receipt', MINI_APP_URL)

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
  } catch (error) {
    console.error('Receipt scan error:', error)
    await ctx.reply('❌ Failed to scan receipt', {
      reply_parameters: { message_id: ctx.message?.message_id || 0 },
    })
  }
}

// Create webhook handler
export const handleUpdate = webhookCallback(bot, 'std/http')
