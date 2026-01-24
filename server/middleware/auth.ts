import type { Context, Next } from 'hono'
import { validateInitData, validateWidgetData, type TelegramUser } from '../lib/telegram'
import { logger } from '../lib/logger'

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    telegramUser: TelegramUser | null
    isAuthenticated: boolean
    authMethod: 'init_data' | 'widget' | null
  }
}

type AuthResult = {
  user: TelegramUser | null
  method: 'init_data' | 'widget' | null
}

/**
 * Extract Telegram user from request headers/params
 * Validates using cryptographic verification - no mocks or fallbacks
 */
async function extractTelegramUser(c: Context): Promise<AuthResult> {
  // Try Mini App init data first (most common for Telegram Mini Apps)
  const initData = c.req.header('x-telegram-init-data') || ''
  if (initData) {
    const user = validateInitData(initData)
    if (user) {
      return { user, method: 'init_data' }
    }
  }

  // Try Widget data from header
  const widgetDataHeader = c.req.header('x-telegram-widget-data')
  if (widgetDataHeader) {
    try {
      const widgetData = JSON.parse(widgetDataHeader)
      const user = validateWidgetData(widgetData)
      if (user) {
        return { user, method: 'widget' }
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
      const user = validateWidgetData(params)
      if (user) {
        return { user, method: 'widget' }
      }
    }
  } catch (error) {
    logger.debug('URL parsing failed for widget data', { url: c.req.url, error })
  }

  // No valid authentication found
  return { user: null, method: null }
}

/**
 * Auth middleware - validates Telegram init data or widget data and sets user context
 * Does NOT reject unauthenticated requests - use requireAuth for that
 *
 * Supports authentication methods:
 * 1. Mini App init data (X-Telegram-Init-Data header)
 * 2. Telegram Login Widget (query params or X-Telegram-Widget-Data header)
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
 * Get the current user from context
 * Throws if no authenticated user - always use with requireAuth middleware
 */
export function getCurrentUser(c: Context): TelegramUser {
  const user = c.get('telegramUser')

  if (!user) {
    logger.error('getCurrentUser called without authenticated user')
    throw new Error('No authenticated user - ensure requireAuth middleware is used')
  }

  return user
}
