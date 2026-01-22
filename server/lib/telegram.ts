import crypto from 'crypto'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  photo?: Array<{
    file_id: string
    file_unique_id: string
    width: number
    height: number
    file_size?: number
  }>
  caption?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  callback_query?: {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
  }
}

/**
 * Validate Telegram Mini App init data
 */
export function validateInitData(initData: string): TelegramUser | null {
  if (!BOT_TOKEN || !initData) return null

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    if (!hash) return null

    // Remove hash from params
    urlParams.delete('hash')

    // Sort params and create data check string
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest()

    // Validate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(params)
      .digest('hex')

    if (calculatedHash !== hash) {
      return null
    }

    // Parse user data
    const userStr = urlParams.get('user')
    if (!userStr) return null

    return JSON.parse(userStr) as TelegramUser
  } catch {
    return null
  }
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
    reply_to_message_id?: number
    reply_markup?: Record<string, unknown>
  }
): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set, skipping message')
    return
  }

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('Failed to send Telegram message:', error)
    throw new Error(`Telegram API error: ${response.status}`)
  }
}

/**
 * Get file download URL from Telegram
 */
export async function getFileUrl(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    if (!data.ok || !data.result?.file_path) return null

    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`
  } catch {
    return null
  }
}

/**
 * Download file from Telegram
 */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  const fileUrl = await getFileUrl(fileId)
  if (!fileUrl) return null

  try {
    const response = await fetch(fileUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}
