import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
  getGroup,
  createGroup,
  upsertUser,
  createExpense,
  getGroupMembers,
} from '../../lib/dynamodb'
import {
  sendMessage,
  downloadFile,
  type TelegramUpdate,
  type TelegramMessage,
} from '../../lib/telegram'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from '../../lib/bedrock'
import { json, error } from '../../lib/response'
import { randomUUID } from 'crypto'

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const update: TelegramUpdate = JSON.parse(event.body || '{}')
    console.log('Telegram update:', JSON.stringify(update, null, 2))

    const message = update.message || update.edited_message
    if (!message) {
      return json({ ok: true })
    }

    await handleMessage(message)

    return json({ ok: true })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    // Always return 200 to Telegram to prevent retries
    return json({ ok: false, error: String(err) })
  }
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id
  const chatType = message.chat.type
  const user = message.from

  if (!user) return

  // Only process group messages
  if (chatType !== 'group' && chatType !== 'supergroup') {
    if (message.text?.startsWith('/start')) {
      await sendMessage(
        chatId,
        'Welcome to Fracti! Add me to a group to start tracking expenses.\n\n' +
          'Commands:\n' +
          '/balance - View your balance\n' +
          '/expenses - View recent expenses\n' +
          '/settle - Get settlement instructions'
      )
    }
    return
  }

  // Ensure group exists in database
  const groupId = String(chatId)
  let group = await getGroup(groupId)

  if (!group) {
    group = await createGroup({
      id: groupId,
      chatId: groupId,
      title: message.chat.title || 'Unnamed Group',
      createdAt: new Date().toISOString(),
      memberCount: 1,
    })
  }

  // Ensure user is registered in group
  await upsertUser(groupId, {
    id: String(user.id),
    telegramId: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    username: user.username,
  })

  // Handle commands
  if (message.text?.startsWith('/')) {
    await handleCommand(message, groupId)
    return
  }

  // Handle photo (receipt scan)
  if (message.photo && message.photo.length > 0) {
    await handlePhoto(message, groupId)
    return
  }

  // Handle text (expense parsing)
  if (message.text) {
    // Only parse if message mentions Fracti or contains expense-like patterns
    const text = message.text.toLowerCase()
    const shouldParse =
      text.includes('@fracti') ||
      text.includes('paid') ||
      text.includes('spent') ||
      text.includes('bought') ||
      text.includes('split') ||
      /\d+\s*(ton|usd|eur|\$)/i.test(message.text)

    if (shouldParse) {
      await handleExpenseMessage(message, groupId)
    }
  }
}

async function handleCommand(
  message: TelegramMessage,
  groupId: string
): Promise<void> {
  const command = message.text?.split(' ')[0].split('@')[0]
  const chatId = message.chat.id

  switch (command) {
    case '/start':
    case '/help':
      await sendMessage(
        chatId,
        '<b>Fracti - Expense Splitting</b>\n\n' +
          'I can help you track and split expenses in this group.\n\n' +
          '<b>Commands:</b>\n' +
          '/balance - View balances\n' +
          '/expenses - Recent expenses\n' +
          '/settle - Settlement suggestions\n' +
          '/add - Add expense manually\n\n' +
          '<b>Automatic:</b>\n' +
          '- Send a message like "I paid 50 for dinner"\n' +
          '- Send a receipt photo to scan it',
        { parse_mode: 'HTML' }
      )
      break

    case '/balance':
      // TODO: Implement balance view
      await sendMessage(chatId, 'Balance feature coming soon!')
      break

    case '/expenses':
      // TODO: Implement expenses view
      await sendMessage(chatId, 'Recent expenses feature coming soon!')
      break

    case '/settle':
      // TODO: Implement settlement suggestions
      await sendMessage(chatId, 'Settlement suggestions coming soon!')
      break

    case '/add':
      await sendMessage(
        chatId,
        'To add an expense, just describe it:\n' +
          '"I paid 50 for dinner with @alice and @bob"\n\n' +
          'Or send a receipt photo!'
      )
      break

    default:
      // Ignore unknown commands
      break
  }
}

async function handleExpenseMessage(
  message: TelegramMessage,
  groupId: string
): Promise<void> {
  const chatId = message.chat.id
  const user = message.from!
  const text = message.text!

  try {
    // Parse the message with AI
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, text)

    // Extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return // Silently fail if no expense detected
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.amount || parsed.amount <= 0 || parsed.confidence < 0.5) {
      return // Not confident enough
    }

    // Get group members
    const members = await getGroupMembers(groupId)
    const memberMap = new Map(
      members.map((m) => [m.username?.toLowerCase(), m])
    )

    // Resolve payer
    let payerId = String(user.id)
    let payerName = user.first_name

    if (parsed.payer) {
      const payerUsername = parsed.payer.toLowerCase().replace('@', '')
      const payerMember = memberMap.get(payerUsername)
      if (payerMember) {
        payerId = payerMember.id
        payerName = payerMember.name
      }
    }

    // Resolve beneficiaries
    let splits = members.map((m) => ({
      userId: m.id,
      userName: m.name,
      amount: parsed.amount / members.length,
    }))

    if (parsed.beneficiaries && parsed.beneficiaries.length > 0) {
      const beneficiaryIds = new Set<string>()

      for (const name of parsed.beneficiaries) {
        const username = name.toLowerCase().replace('@', '')
        const member = memberMap.get(username)
        if (member) {
          beneficiaryIds.add(member.id)
        }
      }

      // Include payer in split
      beneficiaryIds.add(payerId)

      if (beneficiaryIds.size > 0) {
        const splitAmount = parsed.amount / beneficiaryIds.size
        splits = Array.from(beneficiaryIds).map((id) => {
          const member = members.find((m) => m.id === id)
          return {
            userId: id,
            userName: member?.name || 'Unknown',
            amount: splitAmount,
          }
        })
      }
    }

    // Create expense
    const expense = await createExpense({
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

    // Send confirmation
    const splitText =
      splits.length > 1
        ? `Split between ${splits.length} people (${(parsed.amount / splits.length).toFixed(2)} TON each)`
        : 'No split'

    await sendMessage(
      chatId,
      `<b>Expense recorded!</b>\n\n` +
        `${parsed.description}: <b>${parsed.amount} TON</b>\n` +
        `Paid by: ${payerName}\n` +
        `${splitText}`,
      {
        parse_mode: 'HTML',
        reply_to_message_id: message.message_id,
      }
    )
  } catch (err) {
    console.error('Failed to parse expense message:', err)
    // Don't send error message for parsing failures
  }
}

async function handlePhoto(
  message: TelegramMessage,
  groupId: string
): Promise<void> {
  const chatId = message.chat.id

  if (!message.photo || message.photo.length === 0) return

  // Get the largest photo
  const photo = message.photo[message.photo.length - 1]

  try {
    // Download the photo
    const imageBuffer = await downloadFile(photo.file_id)
    if (!imageBuffer) {
      await sendMessage(chatId, 'Failed to download image. Please try again.', {
        reply_to_message_id: message.message_id,
      })
      return
    }

    // Convert to base64
    const imageBase64 = imageBuffer.toString('base64')

    await sendMessage(chatId, 'Scanning receipt...', {
      reply_to_message_id: message.message_id,
    })

    // Parse with AI
    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      imageBase64,
      'image/jpeg'
    )

    // Extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      await sendMessage(chatId, "Couldn't read the receipt. Please try a clearer photo.", {
        reply_to_message_id: message.message_id,
      })
      return
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.items || parsed.items.length === 0) {
      await sendMessage(chatId, 'No items found in the receipt.', {
        reply_to_message_id: message.message_id,
      })
      return
    }

    // Format the receipt summary
    let summary = `<b>Receipt Scanned!</b>\n`
    if (parsed.merchant) {
      summary += `${parsed.merchant}\n`
    }
    summary += '\n'

    for (const item of parsed.items.slice(0, 10)) {
      summary += `- ${item.name}: ${item.price.toFixed(2)} ${parsed.currency}\n`
    }

    if (parsed.items.length > 10) {
      summary += `... and ${parsed.items.length - 10} more items\n`
    }

    summary += `\n<b>Total: ${parsed.total.toFixed(2)} ${parsed.currency}</b>`

    if (parsed.confidence < 0.7) {
      summary += '\n\n<i>Note: Some items may be inaccurate</i>'
    }

    summary +=
      '\n\nOpen the Fracti app to assign items to people and split the expense.'

    await sendMessage(chatId, summary, { parse_mode: 'HTML' })
  } catch (err) {
    console.error('Failed to process receipt:', err)
    await sendMessage(chatId, 'Failed to scan receipt. Please try again.', {
      reply_to_message_id: message.message_id,
    })
  }
}
