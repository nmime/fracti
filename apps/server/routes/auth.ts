import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { Env } from '../lib/factory'
import { validateInitData, validateWidgetData } from '../lib/telegram'
import { authMiddleware, requireAuth, getCurrentUser } from '../middleware/auth'
import { getGroupsByUser } from '../lib/dynamodb'
import { logger } from '../lib/logger'

export const authRoutes = new Hono<Env>()

// Schema for Telegram Widget data validation
const telegramWidgetSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.coerce.number().int().positive(),
  hash: z.string().length(64),
})

// Schema for Mini App init data (URL encoded string)
const initDataSchema = z.object({
  initData: z.string().min(1, 'Init data is required'),
})

/**
 * POST /api/auth/telegram-widget - Validate Telegram Login Widget data
 *
 * This endpoint validates the hash from Telegram Login Widget using HMAC-SHA256
 * and returns the authenticated user if valid. Used for web-based login flows
 * outside the Telegram Mini App context.
 */
authRoutes.post(
  '/telegram-widget',
  zValidator('json', telegramWidgetSchema),
  async (c) => {
    const data = c.req.valid('json')

    // Convert to the format expected by validateWidgetData
    const widgetData: Record<string, string> = {
      id: String(data.id),
      first_name: data.first_name,
      auth_date: String(data.auth_date),
      hash: data.hash,
    }

    // Add optional fields
    if (data.last_name) widgetData.last_name = data.last_name
    if (data.username) widgetData.username = data.username
    if (data.photo_url) widgetData.photo_url = data.photo_url

    const user = validateWidgetData(widgetData)

    if (!user) {
      logger.warn('Telegram widget auth failed', {
        userId: data.id,
        reason: 'Invalid hash or expired auth_date',
      })

      return c.json(
        {
          success: false,
          error: 'Authentication failed',
          message: 'Invalid Telegram widget data. Hash verification failed or auth has expired.',
        },
        401
      )
    }

    logger.info('Telegram widget auth successful', {
      userId: user.id,
      username: user.username,
      method: 'widget',
    })

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          photoUrl: user.photo_url,
          languageCode: user.language_code,
        },
        authMethod: 'widget',
        authenticated: true,
      },
    })
  }
)

/**
 * POST /api/auth/telegram-mini-app - Validate Telegram Mini App init data
 *
 * This endpoint validates the init data from Telegram Mini App WebApp.initData
 * using @grammyjs/validator and returns the authenticated user if valid.
 */
authRoutes.post(
  '/telegram-mini-app',
  zValidator('json', initDataSchema),
  async (c) => {
    const { initData } = c.req.valid('json')

    const user = validateInitData(initData)

    if (!user) {
      logger.warn('Telegram mini app auth failed', {
        reason: 'Invalid init data',
      })

      return c.json(
        {
          success: false,
          error: 'Authentication failed',
          message: 'Invalid Telegram Mini App init data.',
        },
        401
      )
    }

    logger.info('Telegram mini app auth successful', {
      userId: user.id,
      username: user.username,
      method: 'init_data',
    })

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          photoUrl: user.photo_url,
          languageCode: user.language_code,
          isPremium: user.is_premium,
        },
        authMethod: 'init_data',
        authenticated: true,
      },
    })
  }
)

/**
 * GET /api/auth/me - Get current authenticated user
 *
 * Returns the currently authenticated user from the request headers.
 * Uses X-Telegram-Init-Data or X-Telegram-Widget-Data headers for auth.
 */
authRoutes.get('/me', authMiddleware, requireAuth, async (c) => {
  const telegramUser = getCurrentUser(c)
  const authMethod = c.get('authMethod')

  // Get user's group memberships to enrich the response
  const memberships = await getGroupsByUser(telegramUser.id)

  return c.json({
    success: true,
    data: {
      user: {
        id: telegramUser.id,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        photoUrl: telegramUser.photo_url,
        languageCode: telegramUser.language_code,
        isPremium: telegramUser.is_premium,
      },
      authMethod,
      authenticated: true,
      groupCount: memberships.length,
    },
  })
})

/**
 * GET /api/auth/verify - Verify if current auth is valid
 *
 * A lightweight endpoint to check authentication status without
 * fetching additional user data.
 */
authRoutes.get('/verify', authMiddleware, async (c) => {
  const telegramUser = c.get('telegramUser')
  const isAuthenticated = c.get('isAuthenticated')
  const authMethod = c.get('authMethod')

  if (!isAuthenticated || !telegramUser) {
    return c.json(
      {
        success: false,
        error: 'Not authenticated',
        message: 'No valid Telegram authentication found in request.',
        authenticated: false,
      },
      401
    )
  }

  return c.json({
    success: true,
    data: {
      authenticated: true,
      authMethod,
      userId: telegramUser.id,
      username: telegramUser.username,
    },
  })
})

/**
 * GET /api/auth/status - Get auth status (no auth required)
 *
 * Returns the current auth status without requiring authentication.
 * Useful for checking if the user needs to authenticate.
 */
authRoutes.get('/status', authMiddleware, async (c) => {
  const telegramUser = c.get('telegramUser')
  const isAuthenticated = c.get('isAuthenticated')
  const authMethod = c.get('authMethod')

  return c.json({
    success: true,
    data: {
      authenticated: isAuthenticated,
      authMethod: isAuthenticated ? authMethod : null,
      userId: isAuthenticated && telegramUser ? telegramUser.id : null,
    },
  })
})
