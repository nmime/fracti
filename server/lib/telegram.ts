import { validate, parse } from '@grammyjs/validator'
import { createHash, createHmac } from 'crypto'
import { config } from './config'
import { logger } from './logger'

const BOT_TOKEN = config.TELEGRAM_BOT_TOKEN

// Auth window in seconds (5 minutes for security)
const AUTH_WINDOW_SECONDS = 300

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

export interface ValidatedInitData {
  user: TelegramUser
  chat_instance?: string
  chat_type?: string
  auth_date: number
  hash: string
  query_id?: string
  start_param?: string
}

/**
 * Validate Telegram Mini App init data using @grammyjs/validator
 */
export function validateInitData(initData: string): TelegramUser | null {
  if (!BOT_TOKEN || !initData) return null

  try {
    // Validate the init data
    const isValid = validate(initData, BOT_TOKEN)
    if (!isValid) return null

    // Parse the validated data
    const data = parse(initData)

    if (!data.user) return null

    return {
      id: data.user.id,
      first_name: data.user.first_name,
      last_name: data.user.last_name,
      username: data.user.username,
      language_code: data.user.language_code,
      is_premium: data.user.is_premium,
      photo_url: data.user.photo_url,
    }
  } catch (error) {
    logger.error('Init data validation error', {}, error)
    return null
  }
}

/**
 * Validate Telegram Login Widget data
 * Widget data comes as query params: id, first_name, last_name, username, photo_url, auth_date, hash
 */
export function validateWidgetData(data: Record<string, string>): TelegramUser | null {
  if (!BOT_TOKEN || !data.hash || !data.id || !data.auth_date) return null

  try {
    // Build data check string (all fields except hash, sorted alphabetically)
    const checkFields = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Create secret key using SHA-256 of bot token
    const secretKey = createHash('sha256')
      .update(BOT_TOKEN)
      .digest()

    // Calculate HMAC-SHA-256
    const calculatedHash = createHmac('sha256', secretKey)
      .update(checkFields)
      .digest('hex')

    if (calculatedHash !== data.hash) {
      logger.warn('Widget hash mismatch', { userId: data.id })
      return null
    }

    // Check auth_date is not too old (5 minutes for security)
    const authDate = parseInt(data.auth_date, 10)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > AUTH_WINDOW_SECONDS) {
      logger.warn('Widget auth_date expired', { userId: data.id, authDate, now })
      return null
    }

    return {
      id: parseInt(data.id, 10),
      first_name: data.first_name || '',
      last_name: data.last_name,
      username: data.username,
      photo_url: data.photo_url,
    }
  } catch (error) {
    logger.error('Widget validation error', { userId: data.id }, error)
    return null
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
