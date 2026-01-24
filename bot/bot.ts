import { Bot, Context, InlineKeyboard } from 'grammy'
import type { Chat, User } from 'grammy/types'
import { randomUUID } from 'crypto'
import {
  getGroup,
  createGroup,
  upsertUser,
  getUser,
  createExpense,
  getGroupMembers,
  getGroupsByUser,
} from '@core/db'
import $ from '@core/constants'
import { extractJSON } from '@core/tools'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from './ai'
import {
  downloadFile,
  downloadUserProfilePhoto,
  uploadAvatar,
} from './middleware'

// Translations
const translations = {
  en: {
    'bot.welcome.openApp': 'Open Fracti',
    'bot.welcome.private': 'Welcome to Fracti!',
    'bot.welcome.privateDescription': 'I help groups split expenses and settle debts on-chain.',
    'bot.welcome.group': 'Fracti is ready to track expenses!',
    'bot.welcome.groupDescription': 'Mention me with expense details to add them automatically.',
    'bot.help.title': 'Fracti Commands',
    'bot.help.balance': '/balance - View group balances',
    'bot.help.expenses': '/expenses - View recent expenses',
    'bot.help.settle': '/settle - Settle debts',
    'bot.help.add': '/add - How to add expenses',
    'bot.help.automatic': '<b>Automatic parsing:</b>',
    'bot.help.example1': '• "I paid 50 for dinner"',
    'bot.help.example2': '• "@Alice bought groceries for 25"',
    'bot.help.example3': '• Send a receipt photo',
    'bot.help.openAppCta': 'Click below to open the app!',
    'bot.balance.title': 'View Balances',
    'bot.balance.openApp': 'Open the app to view balances and settle debts.',
    'bot.expenses.title': 'View Expenses',
    'bot.expenses.openApp': 'Open the app to view and manage expenses.',
    'bot.settle.title': 'Settle Up',
    'bot.settle.openApp': 'Open the app to settle debts with TON.',
    'bot.add.title': 'Adding Expenses',
    'bot.add.description': 'Just mention me with the expense details:',
    'bot.add.examples': '<b>Examples:</b>',
    'bot.add.example1': '• @FractiBot paid 50 for dinner',
    'bot.add.example2': '• @FractiBot Alice bought groceries 25',
    'bot.add.example3': '• @FractiBot split uber 30 with Bob',
    'bot.add.tip': '💡 <i>Or send a receipt photo!</i>',
    'bot.expense.created': 'Expense added: <b>{description}</b> for {amount}',
    'bot.expense.paidBy': 'Paid by {name}',
    'bot.expense.splitWays': 'Split {count} ways ({each} each)',
    'bot.receipt.downloadError': 'Could not download the image. Please try again.',
    'bot.receipt.scanning': 'Scanning receipt...',
    'bot.receipt.parseError': 'Could not read the receipt. Please enter manually.',
    'bot.receipt.noItems': 'No items found in the receipt.',
    'bot.receipt.success': 'Receipt scanned: <b>{merchant}</b>',
    'bot.receipt.total': 'Total: {amount} {currency}',
    'bot.receipt.scanError': 'Error scanning receipt. Please try again.',
  },
  ru: {
    'bot.welcome.openApp': 'Открыть Fracti',
    'bot.welcome.private': 'Добро пожаловать в Fracti!',
    'bot.welcome.privateDescription': 'Я помогаю группам делить расходы и рассчитываться в блокчейне.',
    'bot.welcome.group': 'Fracti готов отслеживать расходы!',
    'bot.welcome.groupDescription': 'Упомяните меня с деталями расхода, чтобы добавить их автоматически.',
    'bot.help.title': 'Команды Fracti',
    'bot.help.balance': '/balance - Посмотреть балансы группы',
    'bot.help.expenses': '/expenses - Посмотреть расходы',
    'bot.help.settle': '/settle - Рассчитаться по долгам',
    'bot.help.add': '/add - Как добавлять расходы',
    'bot.help.automatic': '<b>Автоматический разбор:</b>',
    'bot.help.example1': '• "Я заплатил 50 за ужин"',
    'bot.help.example2': '• "@Алиса купила продукты за 25"',
    'bot.help.example3': '• Отправьте фото чека',
    'bot.help.openAppCta': 'Нажмите ниже, чтобы открыть приложение!',
    'bot.balance.title': 'Балансы',
    'bot.balance.openApp': 'Откройте приложение для просмотра балансов.',
    'bot.expenses.title': 'Расходы',
    'bot.expenses.openApp': 'Откройте приложение для управления расходами.',
    'bot.settle.title': 'Рассчитаться',
    'bot.settle.openApp': 'Откройте приложение для расчёта в TON.',
    'bot.add.title': 'Добавление расходов',
    'bot.add.description': 'Просто упомяните меня с деталями расхода:',
    'bot.add.examples': '<b>Примеры:</b>',
    'bot.add.example1': '• @FractiBot заплатил 50 за ужин',
    'bot.add.example2': '• @FractiBot Алиса купила продукты 25',
    'bot.add.example3': '• @FractiBot разделить такси 30 с Бобом',
    'bot.add.tip': '💡 <i>Или отправьте фото чека!</i>',
    'bot.expense.created': 'Расход добавлен: <b>{description}</b> на {amount}',
    'bot.expense.paidBy': 'Оплатил {name}',
    'bot.expense.splitWays': 'Разделено на {count} ({each} каждому)',
    'bot.receipt.downloadError': 'Не удалось загрузить изображение. Попробуйте снова.',
    'bot.receipt.scanning': 'Сканирую чек...',
    'bot.receipt.parseError': 'Не удалось прочитать чек. Введите вручную.',
    'bot.receipt.noItems': 'Позиции в чеке не найдены.',
    'bot.receipt.success': 'Чек отсканирован: <b>{merchant}</b>',
    'bot.receipt.total': 'Итого: {amount} {currency}',
    'bot.receipt.scanError': 'Ошибка сканирования чека. Попробуйте снова.',
  },
}

type TranslationKey = keyof typeof translations.en
type Locale = 'en' | 'ru'

function getLocaleFromLanguageCode(code?: string): Locale {
  if (code?.startsWith('ru')) return 'ru'
  return 'en'
}

function createTranslator(locale: Locale) {
  const strings = translations[locale] || translations.en
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = strings[key] || translations.en[key] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}

function isGroupChat(chat: Chat): chat is Chat.GroupChat | Chat.SupergroupChat {
  return chat.type === 'group' || chat.type === 'supergroup'
}

function getChatTitle(chat: Chat | undefined): string {
  if (!chat) return 'Group'
  if (isGroupChat(chat)) {
    return chat.title
  }
  return 'Group'
}

const getBotToken = () => {
  const token = process.env[$.env.TELEGRAM_BOT_TOKEN] || ''
  console.log('Bot token configured:', token ? `${token.substring(0, 10)}...` : 'EMPTY')
  return token
}
const getMiniAppUrl = () => process.env[$.env.MINI_APP_URL] || 'https://t.me/FractiBot/app'

// Create bot instance
console.log('Initializing bot...')
export const bot = new Bot(getBotToken())
console.log('Bot initialized')

function getT(ctx: Context) {
  const locale = getLocaleFromLanguageCode(ctx.from?.language_code)
  return createTranslator(locale)
}

async function registerUserWithAvatar(
  groupId: string,
  user: User
): Promise<void> {
  const telegramId = user.id
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')

  const existingUser = await getUser(groupId, telegramId)

  let avatarUrl = existingUser?.avatarUrl

  if (!avatarUrl) {
    try {
      const photo = await downloadUserProfilePhoto(telegramId)
      if (photo) {
        avatarUrl = await uploadAvatar(telegramId, photo.buffer, photo.mimeType)
      }
    } catch {
      // Continue without avatar
    }
  }

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
    const keyboard = new InlineKeyboard()
      .webApp(t('bot.welcome.openApp'), getMiniAppUrl())
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
    const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), getMiniAppUrl())

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
  const keyboard = new InlineKeyboard().webApp(t('bot.welcome.openApp'), getMiniAppUrl())

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
  const keyboard = new InlineKeyboard().webApp(t('bot.balance.title'), getMiniAppUrl())

  await ctx.reply(`📊 ${t('bot.balance.openApp')}`, {
    reply_markup: keyboard,
  })
})

bot.command('expenses', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.expenses.title'), getMiniAppUrl())

  await ctx.reply(`📝 ${t('bot.expenses.openApp')}`, {
    reply_markup: keyboard,
  })
})

bot.command('settle', async (ctx) => {
  const t = getT(ctx)
  const keyboard = new InlineKeyboard().webApp(t('bot.settle.title'), getMiniAppUrl())

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

// Handle ALL text messages
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

async function handleExpenseMessage(ctx: Context): Promise<void> {
  const t = getT(ctx)
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
    const splitText =
      splits.length > 1
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
  const t = getT(ctx)
  const chatId = ctx.chat?.id
  const user = ctx.from
  const photos = ctx.message?.photo

  if (!chatId || !user || !photos?.length) return

  const groupId = String(chatId)
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

    const receiptTotal = parsed.total ?? parsed.items.reduce((sum: number, item: { name: string; price: number }) => sum + item.price, 0)

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

// Inline mode
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query.trim()
  const userId = ctx.from.id

  const match = query.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)

  const results = []

  if (match) {
    const amount = parseFloat(match[1])
    const description = match[2] || 'Expense'

    const memberships = await getGroupsByUser(userId)

    if (memberships.length > 0) {
      for (const membership of memberships.slice(0, 10)) {
        const groupId = membership.GSI1SK?.replace('GROUP#', '') || ''
        const group = await getGroup(groupId)
        if (!group) continue

        results.push({
          type: 'article' as const,
          id: `expense-${groupId}-${Date.now()}`,
          title: `💸 ${amount} - ${description}`,
          description: `Add to ${group.title}`,
          input_message_content: {
            message_text: `💸 <b>New Expense</b>\n\n` +
              `Amount: <b>${amount} ${group.currency ?? 'TON'}</b>\n` +
              `Description: ${description}\n` +
              `Group: ${group.title}\n\n` +
              `<i>Open the app to confirm and split this expense</i>`,
            parse_mode: 'HTML' as const,
          },
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Add Expense', web_app: { url: `${getMiniAppUrl()}?group=${groupId}&amount=${amount}&desc=${encodeURIComponent(description)}` } }
            ]]
          },
        })
      }
    }

    results.push({
      type: 'article' as const,
      id: `expense-new-${Date.now()}`,
      title: `💸 ${amount} - ${description}`,
      description: 'Share expense details',
      input_message_content: {
        message_text: `💸 <b>Expense to Split</b>\n\n` +
          `Amount: <b>${amount}</b>\n` +
          `Description: ${description}\n\n` +
          `<i>Add me to a group to track shared expenses!</i>`,
        parse_mode: 'HTML' as const,
      },
    })
  } else if (query.length === 0) {
    results.push({
      type: 'article' as const,
      id: 'help',
      title: '💡 How to use inline mode',
      description: 'Type: amount description (e.g., "50 dinner")',
      input_message_content: {
        message_text: `💡 <b>Fracti Inline Mode</b>\n\n` +
          `Type: <code>@${ctx.me.username} 50 dinner</code>\n\n` +
          `This lets you quickly share expenses in any chat!`,
        parse_mode: 'HTML' as const,
      },
    })
  }

  await ctx.answerInlineQuery(results, {
    cache_time: 10,
    is_personal: true,
  })
})

// Initialize bot once
let botInitialized = false

async function ensureBotInitialized(): Promise<void> {
  if (!botInitialized) {
    console.log('Initializing bot for first request...')
    await bot.init()
    botInitialized = true
    console.log('Bot initialized with info:', bot.botInfo.username)
  }
}

// Handle update directly for Lambda compatibility
export async function handleUpdate(request: Request): Promise<Response> {
  try {
    const body = await request.text()
    console.log('Received update body length:', body.length)

    if (!body) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const update = JSON.parse(body)
    console.log('Parsed update, type:', update.message ? 'message' : update.callback_query ? 'callback' : 'other')

    // Ensure bot is initialized before processing
    await ensureBotInitialized()

    // Process the update
    await bot.handleUpdate(update)
    console.log('Update processed successfully')

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing update:', error)
    // Return 200 to prevent Telegram retries
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
