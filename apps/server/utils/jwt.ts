import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { TelegramUser } from '../integrations/telegram';

const JWT_SECRET = config.JWT_SECRET || config.TELEGRAM_BOT_TOKEN;
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  sub: number; // Telegram user ID
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium?: boolean;
  iat: number;
  exp: number;
}

/**
 * Generate JWT token for authenticated Telegram user
 */
export function generateToken(user: TelegramUser): string {
  const payload = {
    sub: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    photoUrl: user.photo_url,
    languageCode: user.language_code,
    isPremium: user.is_premium,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
      return decoded as unknown as JWTPayload;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert JWT payload back to TelegramUser format
 */
export function payloadToUser(payload: JWTPayload): TelegramUser {
  return {
    id: payload.sub,
    first_name: payload.firstName,
    last_name: payload.lastName,
    username: payload.username,
    photo_url: payload.photoUrl,
    language_code: payload.languageCode,
    is_premium: payload.isPremium,
  };
}
