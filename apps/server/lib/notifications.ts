import { Bot } from 'grammy'
import { config } from '../config'
import { logger } from '../utils/logger'

/**
 * Telegram notification service using Grammy
 */

// Create a separate bot instance for notifications
const notificationBot = new Bot(config.TELEGRAM_BOT_TOKEN)

export interface NotificationOptions {
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableNotification?: boolean
}

/**
 * Send a text message to a Telegram chat
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options: NotificationOptions = {}
): Promise<boolean> {
  try {
    await notificationBot.api.sendMessage(chatId, text, {
      parse_mode: options.parseMode ?? 'HTML',
      disable_notification: options.disableNotification ?? false,
    })
    return true
  } catch (error) {
    logger.error('Failed to send Telegram message', { chatId }, error as Error)
    return false
  }
}

/**
 * Notify group about a new expense
 */
export async function notifyNewExpense(
  chatId: string,
  payerName: string,
  amount: number,
  currency: string,
  description: string,
  beneficiaries: Array<{ userName: string; amount: number }>
): Promise<void> {
  const beneficiaryList = beneficiaries
    .map((b) => `  • ${escapeHtml(b.userName)}: ${b.amount.toFixed(2)} ${currency}`)
    .join('\n')

  const message = `💸 <b>New Expense</b>

<b>${escapeHtml(payerName)}</b> paid <b>${amount.toFixed(2)} ${currency}</b>
📝 ${escapeHtml(description)}

<b>Split:</b>
${beneficiaryList}

<i>Open the app to view details</i>`

  await sendMessage(chatId, message)
}

/**
 * Notify group about a settlement
 */
export async function notifySettlement(
  chatId: string,
  fromName: string,
  toName: string,
  amount: number,
  currency: string,
  status: 'pending' | 'completed'
): Promise<void> {
  const statusEmoji = status === 'completed' ? '✅' : '⏳'
  const statusText = status === 'completed' ? 'completed' : 'initiated'

  const message = `${statusEmoji} <b>Settlement ${statusText}</b>

<b>${escapeHtml(fromName)}</b> → <b>${escapeHtml(toName)}</b>
💰 ${amount.toFixed(2)} ${currency}

<i>Debt has been ${status === 'completed' ? 'settled' : 'recorded'}</i>`

  await sendMessage(chatId, message)
}

/**
 * Notify user about a recurring expense being created
 */
export async function notifyRecurringExpense(
  chatId: string,
  templateName: string,
  amount: number,
  currency: string,
  nextDate: string
): Promise<void> {
  const message = `🔄 <b>Recurring Expense Created</b>

📋 ${escapeHtml(templateName)}
💰 ${amount.toFixed(2)} ${currency}
📅 Next: ${new Date(nextDate).toLocaleDateString()}

<i>This expense will be automatically added on schedule</i>`

  await sendMessage(chatId, message)
}

/**
 * Send daily/weekly summary to a group
 */
export async function notifyGroupSummary(
  chatId: string,
  period: 'daily' | 'weekly',
  totalExpenses: number,
  expenseCount: number,
  currency: string,
  topSpender?: { name: string; amount: number }
): Promise<void> {
  const periodText = period === 'daily' ? 'Today' : 'This Week'

  let message = `📊 <b>${periodText}'s Summary</b>

💸 Total: <b>${totalExpenses.toFixed(2)} ${currency}</b>
📝 Expenses: ${expenseCount}
`

  if (topSpender) {
    message += `👑 Top spender: ${escapeHtml(topSpender.name)} (${topSpender.amount.toFixed(2)} ${currency})`
  }

  await sendMessage(chatId, message)
}

/**
 * Notify user directly (private message)
 */
export async function notifyUser(
  userId: number,
  message: string
): Promise<boolean> {
  return sendMessage(userId, message)
}

/**
 * Send inline keyboard with action buttons
 */
export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>>
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notificationBot.api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons as any,
      },
    })
    return true
  } catch (error) {
    logger.error('Failed to send message with buttons', { chatId }, error as Error)
    return false
  }
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
