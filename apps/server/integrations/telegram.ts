import { createHash, createHmac } from 'crypto';
import { validateWebAppData } from '@grammyjs/validator';
import {
  getFileUrl as getFileUrlBase,
  downloadFile as downloadFileBase,
  getUserProfilePhoto as getUserProfilePhotoBase,
  downloadUserProfilePhoto as downloadUserProfilePhotoBase,
} from '@libs/integrations';
import { config } from '../config';
import { logger } from '../utils/logger';

const BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
const AUTH_WINDOW_SECONDS = 86400; // 24 hours (Telegram recommends checking within 1 day for login widget)

function parseInitData(initData: string): URLSearchParams {
  return new URLSearchParams(initData);
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }[];
  caption?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export interface ValidatedInitData {
  user: TelegramUser;
  chat_instance?: string;
  chat_type?: string;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string;
}

/**
 * Validate Telegram Mini App init data
 */
export function validateInitData(initData: string): TelegramUser | null {
  if (!BOT_TOKEN || !initData) return null;

  try {
    const params = parseInitData(initData);
    const isValid = validateWebAppData(BOT_TOKEN, params);
    if (!isValid) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    if (!user || typeof user.id !== 'number') return null;

    return {
      id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name,
      username: user.username,
      language_code: user.language_code,
      is_premium: user.is_premium,
      photo_url: user.photo_url,
    };
  } catch (error) {
    logger.error('Init data validation error', {}, error);

    return null;
  }
}

/**
 * Validate Telegram Login Widget data
 */
export function validateWidgetData(data: Record<string, string | number>): TelegramUser | null {
  if (!BOT_TOKEN || !data.hash || !data.id || !data.auth_date) return null;

  try {
    // Convert all values to strings for hash verification
    const checkFields = Object.entries(data)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('\n');

    const secretKey = createHash('sha256').update(BOT_TOKEN).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(checkFields).digest('hex');

    if (calculatedHash !== String(data.hash)) {
      logger.warn('Widget hash mismatch', { userId: data.id });

      return null;
    }

    const authDate = typeof data.auth_date === 'number' ? data.auth_date : parseInt(data.auth_date, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > AUTH_WINDOW_SECONDS) {
      logger.warn('Widget auth_date expired', { userId: data.id, authDate, now });

      return null;
    }

    return {
      id: typeof data.id === 'number' ? data.id : parseInt(data.id, 10),
      first_name: String(data.first_name || ''),
      last_name: data.last_name ? String(data.last_name) : undefined,
      username: data.username ? String(data.username) : undefined,
      photo_url: data.photo_url ? String(data.photo_url) : undefined,
    };
  } catch (error) {
    logger.error('Widget validation error', { userId: data.id }, error);

    return null;
  }
}

/**
 * Get file download URL from Telegram
 */
export async function getFileUrl(fileId: string): Promise<string | null> {
  return getFileUrlBase(fileId, BOT_TOKEN);
}

/**
 * Download file from Telegram
 */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  return downloadFileBase(fileId, BOT_TOKEN);
}

/**
 * Get user profile photos from Telegram
 */
export async function getUserProfilePhoto(userId: number): Promise<string | null> {
  return getUserProfilePhotoBase(userId, BOT_TOKEN, logger);
}

/**
 * Download user's profile photo as Buffer
 */
export async function downloadUserProfilePhoto(userId: number): Promise<{ buffer: Buffer; mimeType: string } | null> {
  return downloadUserProfilePhotoBase(userId, BOT_TOKEN, logger);
}
