import type { Context, Next } from 'hono'
import { validateInitData, validateWidgetData, type TelegramUser } from '../lib/telegram'

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    telegramUser: TelegramUser | null
    isAuthenticated: boolean
    authMethod: 'init_data' | 'widget' | 'dev' | null
  }
}

/**
 * Auth middleware - validates Telegram init data or widget data and sets user context
 * Supports multiple authentication methods:
 * 1. Mini App init data (X-Telegram-Init-Data header)
 * 2. Telegram Login Widget (query params or X-Telegram-Widget-Data header)
 * 3. Development mode bypass
 */
export async function authMiddleware(c: Context, next: Next) {
  const isDev = process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'development'

  let telegramUser: TelegramUser | null = null
  let authMethod: 'init_data' | 'widget' | 'dev' | null = null

  // Try Mini App init data first
  const initData = c.req.header('x-telegram-init-data') || ''
  if (initData) {
    telegramUser = validateInitData(initData)
    if (telegramUser) authMethod = 'init_data'
  }

  // Try Widget data if init data not present
  if (!telegramUser) {
    // Check header first
    const widgetDataHeader = c.req.header('x-telegram-widget-data')
    if (widgetDataHeader) {
      try {
        const widgetData = JSON.parse(widgetDataHeader)
        telegramUser = validateWidgetData(widgetData)
        if (telegramUser) authMethod = 'widget'
      } catch {
        // Invalid JSON in header
      }
    }

    // Check query params if header not present
    if (!telegramUser) {
      const url = new URL(c.req.url)
      const params: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        params[key] = value
      })

      if (params.hash && params.id && params.auth_date) {
        telegramUser = validateWidgetData(params)
        if (telegramUser) authMethod = 'widget'
      }
    }
  }

  // Development mode bypass
  if (!telegramUser && isDev) {
    authMethod = 'dev'
  }

  c.set('telegramUser', telegramUser)
  c.set('isAuthenticated', !!telegramUser || isDev)
  c.set('authMethod', authMethod)

  await next()
}

/**
 * Require authentication middleware - returns 401 if not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const isDev = process.env.AWS_SAM_LOCAL === 'true' || process.env.NODE_ENV === 'development'

  let telegramUser: TelegramUser | null = null
  let authMethod: 'init_data' | 'widget' | 'dev' | null = null

  // Try Mini App init data first
  const initData = c.req.header('x-telegram-init-data') || ''
  if (initData) {
    telegramUser = validateInitData(initData)
    if (telegramUser) authMethod = 'init_data'
  }

  // Try Widget data if init data not present
  if (!telegramUser) {
    const widgetDataHeader = c.req.header('x-telegram-widget-data')
    if (widgetDataHeader) {
      try {
        const widgetData = JSON.parse(widgetDataHeader)
        telegramUser = validateWidgetData(widgetData)
        if (telegramUser) authMethod = 'widget'
      } catch {
        // Invalid JSON in header
      }
    }

    if (!telegramUser) {
      const url = new URL(c.req.url)
      const params: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        params[key] = value
      })

      if (params.hash && params.id && params.auth_date) {
        telegramUser = validateWidgetData(params)
        if (telegramUser) authMethod = 'widget'
      }
    }
  }

  if (!telegramUser && !isDev) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Valid Telegram authentication required (Mini App init data or Login Widget)',
      },
      401
    )
  }

  if (isDev && !telegramUser) {
    authMethod = 'dev'
  }

  c.set('telegramUser', telegramUser)
  c.set('isAuthenticated', true)
  c.set('authMethod', authMethod)

  await next()
}

/**
 * Get mock user for development
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
