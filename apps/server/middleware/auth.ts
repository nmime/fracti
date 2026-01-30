import { validateInitData, validateWidgetData, type TelegramUser } from '../integrations/telegram';
import { verifyToken, payloadToUser } from '../utils/jwt';
import { logger } from '../utils/logger';
import type { Context, Next } from 'hono';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    telegramUser: TelegramUser | null;
    isAuthenticated: boolean;
    authMethod: 'jwt' | 'init_data' | 'widget' | null;
  }
}

interface AuthResult {
  user: TelegramUser | null;
  method: 'jwt' | 'init_data' | 'widget' | null;
}

/**
 * Extract and validate user from request
 * Priority: JWT > init_data > widget
 */
async function extractUser(c: Context): Promise<AuthResult> {
  // 1. Try JWT token first (recommended)
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      return { user: payloadToUser(payload), method: 'jwt' };
    }
  }

  // 2. Try Mini App init data (for direct Telegram Mini App access)
  const initData = c.req.header('x-telegram-init-data') || '';
  if (initData) {
    const user = validateInitData(initData);
    if (user) {
      return { user, method: 'init_data' };
    }
  }

  // 3. Try Widget data from header (legacy, for direct widget auth)
  const widgetDataHeader = c.req.header('x-telegram-widget-data');
  if (widgetDataHeader) {
    try {
      const widgetData = JSON.parse(widgetDataHeader);
      const user = validateWidgetData(widgetData);
      if (user) {
        return { user, method: 'widget' };
      }
    } catch (error) {
      logger.debug('Invalid JSON in widget data header', { error });
    }
  }

  return { user: null, method: null };
}

/**
 * Auth middleware - validates and sets user context
 * Does NOT reject unauthenticated requests
 */
export async function authMiddleware(c: Context, next: Next) {
  const { user, method } = await extractUser(c);

  c.set('telegramUser', user);
  c.set('isAuthenticated', user !== null);
  c.set('authMethod', method);

  await next();
}

/**
 * Require authentication middleware - returns 401 if not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const { user, method } = await extractUser(c);

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required. Please login via /auth/login endpoint.',
      },
      401,
    );
  }

  c.set('telegramUser', user);
  c.set('isAuthenticated', true);
  c.set('authMethod', method);

  return next();
}

/**
 * Get the current user from context
 */
export function getCurrentUser(c: Context): TelegramUser {
  const user = c.get('telegramUser');

  if (!user) {
    logger.error('getCurrentUser called without authenticated user');
    throw new Error('No authenticated user');
  }

  return user;
}
