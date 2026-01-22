import type { Context, Next } from 'hono'
import { validateInitData, validateWidgetData, type TelegramUser } from '../lib/telegram'
import { isLocalDev } from '../lib/config'
import { logger } from '../lib/logger'

// Track if we've already logged the dev mode warning (avoid spam)
let devModeWarningLogged = false

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    telegramUser: TelegramUser | null
    isAuthenticated: boolean
    authMethod: 'init_data' | 'widget' | 'dev' | null
  }
}

/**
 * Development mode demo user
 */
export function getDevUser(): TelegramUser {
  return {
    id: 123456789,
    first_name: 'Demo',
    last_name: 'User',
    username: 'demouser',
    language_code: 'en',
  }
}

type AuthResult = {
  user: TelegramUser | null
  method: 'init_data' | 'widget' | 'dev' | null
}

/**
 * Extract Telegram user from request headers/params
 * Shared logic between auth middleware variants
 */
async function extractTelegramUser(c: Context): Promise<AuthResult> {
  let user: TelegramUser | null = null
  let method: AuthResult['method'] = null

  // Try Mini App init data first (most common for Telegram Mini Apps)
  const initData = c.req.header('x-telegram-init-data') || ''
  if (initData) {
    user = validateInitData(initData)
    if (user) {
      method = 'init_data'
      return { user, method }
    }
  }

  // Try Widget data from header
  const widgetDataHeader = c.req.header('x-telegram-widget-data')
  if (widgetDataHeader) {
    try {
      const widgetData = JSON.parse(widgetDataHeader)
      user = validateWidgetData(widgetData)
      if (user) {
        method = 'widget'
        return { user, method }
      }
    } catch (error) {
      logger.debug('Invalid JSON in widget data header', { error })
    }
  }

  // Try Widget data from query params
  try {
    const url = new URL(c.req.url)
    const params: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })

    if (params.hash && params.id && params.auth_date) {
      user = validateWidgetData(params)
      if (user) {
        method = 'widget'
        return { user, method }
      }
    }
  } catch (error) {
    logger.debug('URL parsing failed for widget data', { url: c.req.url, error })
  }

  // Development mode: return demo user
  // WARNING: This bypasses authentication - only enabled when NODE_ENV=development or AWS_SAM_LOCAL=true
  if (isLocalDev) {
    if (!devModeWarningLogged) {
      logger.warn('Development mode auth bypass is active - using demo user for unauthenticated requests', {
        reason: 'No valid Telegram credentials provided in development mode',
      })
      devModeWarningLogged = true
    }
    return { user: getDevUser(), method: 'dev' }
  }

  return { user: null, method: null }
}

/**
 * Auth middleware - validates Telegram init data or widget data and sets user context
 * Does NOT reject unauthenticated requests - use requireAuth for that
 *
 * Supports multiple authentication methods:
 * 1. Mini App init data (X-Telegram-Init-Data header)
 * 2. Telegram Login Widget (query params or X-Telegram-Widget-Data header)
 * 3. Development mode bypass (returns demo user)
 */
export async function authMiddleware(c: Context, next: Next) {
  const { user, method } = await extractTelegramUser(c)

  c.set('telegramUser', user)
  c.set('isAuthenticated', user !== null)
  c.set('authMethod', method)

  await next()
}

/**
 * Require authentication middleware - returns 401 if not authenticated
 * Use this for routes that require a logged-in user
 */
export async function requireAuth(c: Context, next: Next) {
  const { user, method } = await extractTelegramUser(c)

  if (!user) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Valid Telegram authentication required (Mini App init data or Login Widget)',
      },
      401
    )
  }

  c.set('telegramUser', user)
  c.set('isAuthenticated', true)
  c.set('authMethod', method)

  await next()
}

/**
 * Get the current user from context, or dev user if in development
 * Useful for routes that use authMiddleware but need a user object
 */
export function getCurrentUser(c: Context): TelegramUser {
  return c.get('telegramUser') ?? getDevUser()
}
