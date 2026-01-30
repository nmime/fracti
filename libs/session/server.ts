import { createHmac } from 'crypto';
import type { SessionData, SessionStore, SessionConfig } from './types';
import type { TelegramUser } from '@libs/types';

/**
 * Server-side session management
 */

export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, { data: SessionData; expiresAt: number }>();

  async get(key: string): Promise<SessionData | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);

      return null;
    }

    return entry.data;
  }

  async set(key: string, data: SessionData, ttlSeconds = 3600): Promise<void> {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Cleanup expired sessions
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Validate Telegram WebApp init data
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): { valid: boolean; user?: TelegramUser; error?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, error: 'Missing hash' };
    }

    // Remove hash from params and sort
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate secret key
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

    // Calculate hash
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false, error: 'Invalid hash' };
    }

    // Check auth_date (optional: reject old data)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10) * 1000;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - authTimestamp > maxAge) {
        return { valid: false, error: 'Init data expired' };
      }
    }

    // Parse user data
    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false, error: 'Missing user data' };
    }

    const user = JSON.parse(userJson) as TelegramUser;

    return { valid: true, user };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Create a session from validated init data
 */
export function createSession(user: TelegramUser, initData: string, config: SessionConfig): SessionData {
  const initDataHash = createHmac('sha256', config.secret).update(initData).digest('hex').slice(0, 16);

  return {
    user,
    initData,
    initDataHash,
    expiresAt: Date.now() + config.ttlSeconds * 1000,
  };
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Default session store instance
export const sessionStore = new InMemorySessionStore();
