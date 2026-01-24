import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'

// Mock config before importing auth middleware
vi.mock('@server/lib/config', () => ({
  config: {
    NODE_ENV: 'test',
    AWS_SAM_LOCAL: false,
    TABLE_NAME: 'fracti-test',
    S3_BUCKET_NAME: 'fracti-test-bucket',
    TELEGRAM_BOT_TOKEN: 'test-token:ABC123',
    MINI_APP_URL: 'https://t.me/FractiBot/app',
    BEDROCK_MODEL_ID: 'anthropic.claude-sonnet-4-20250514-v1:0',
    AWS_REGION: 'us-east-1',
    ALLOWED_ORIGINS: ['http://localhost:3000'],
    TONCENTER_API_URL: 'https://toncenter.com/api/v3',
    SKIP_TON_VERIFICATION: false,
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  isLocalDev: false,
  getAllowedOrigins: () => ['http://localhost:3000'],
}))

// Mock logger
vi.mock('@server/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock telegram validation
vi.mock('@server/lib/telegram', () => ({
  validateInitData: vi.fn((data: string) => {
    if (data === 'valid-init-data') {
      return {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'en',
      }
    }
    return null
  }),
  validateWidgetData: vi.fn((data: Record<string, string>) => {
    if (data.hash === 'valid-hash' && data.id && data.auth_date) {
      return {
        id: parseInt(data.id),
        first_name: 'Widget',
        last_name: 'User',
        username: 'widgetuser',
        language_code: 'en',
      }
    }
    return null
  }),
}))

import { authMiddleware, requireAuth, getCurrentUser } from '@server/middleware/auth'

describe('Auth Middleware', () => {
  describe('authMiddleware', () => {
    it('should set user context when valid init data is provided', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => {
        const user = c.get('telegramUser')
        const isAuth = c.get('isAuthenticated')
        const method = c.get('authMethod')
        return c.json({ user, isAuth, method })
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'valid-init-data',
        },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.isAuth).toBe(true)
      expect(json.method).toBe('init_data')
      expect(json.user.id).toBe(123456789)
      expect(json.user.username).toBe('testuser')
    })

    it('should set user context when valid widget data header is provided', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => {
        const user = c.get('telegramUser')
        const isAuth = c.get('isAuthenticated')
        const method = c.get('authMethod')
        return c.json({ user, isAuth, method })
      })

      const widgetData = JSON.stringify({
        hash: 'valid-hash',
        id: '987654321',
        auth_date: '1234567890',
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-widget-data': widgetData,
        },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.isAuth).toBe(true)
      expect(json.method).toBe('widget')
      expect(json.user.username).toBe('widgetuser')
    })

    it('should set null user for invalid init data', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => {
        const user = c.get('telegramUser')
        const isAuth = c.get('isAuthenticated')
        return c.json({ user, isAuth })
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'invalid-data',
        },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.isAuth).toBe(false)
      expect(json.user).toBeNull()
    })

    it('should allow request to continue without auth header', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')
      expect(res.status).toBe(200)
    })
  })

  describe('requireAuth', () => {
    it('should return 401 when no valid auth is provided', async () => {
      const app = new Hono()
      app.use('*', requireAuth)
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')
      expect(res.status).toBe(401)

      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid init data', async () => {
      const app = new Hono()
      app.use('*', requireAuth)
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'invalid-data',
        },
      })

      expect(res.status).toBe(401)
    })

    it('should allow request when valid auth is provided', async () => {
      const app = new Hono()
      app.use('*', requireAuth)
      app.get('/test', (c) => {
        const user = c.get('telegramUser')
        return c.json({ ok: true, user })
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'valid-init-data',
        },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.ok).toBe(true)
      expect(json.user.username).toBe('testuser')
    })

    it('should set correct context variables on success', async () => {
      const app = new Hono()
      app.use('*', requireAuth)
      app.get('/test', (c) => {
        return c.json({
          user: c.get('telegramUser'),
          isAuthenticated: c.get('isAuthenticated'),
          authMethod: c.get('authMethod'),
        })
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'valid-init-data',
        },
      })

      const json = await res.json()
      expect(json.isAuthenticated).toBe(true)
      expect(json.authMethod).toBe('init_data')
      expect(json.user).toBeDefined()
    })
  })

  describe('getCurrentUser', () => {
    it('should return telegramUser from context when available', async () => {
      const app = new Hono()
      app.use('*', authMiddleware)
      app.get('/test', (c) => {
        const user = getCurrentUser(c)
        return c.json({ user })
      })

      const res = await app.request('/test', {
        headers: {
          'x-telegram-init-data': 'valid-init-data',
        },
      })

      const json = await res.json()
      expect(json.user.username).toBe('testuser')
    })

    it('should throw error when no user in context', async () => {
      const app = new Hono()
      app.get('/test', (c) => {
        // This should throw an error since no user is authenticated
        try {
          const user = getCurrentUser(c)
          return c.json({ user })
        } catch (error) {
          return c.json({ error: (error as Error).message }, 500)
        }
      })

      const res = await app.request('/test')

      expect(res.status).toBe(500)
      const json = await res.json()
      expect(json.error).toContain('No authenticated user')
    })
  })
})

describe('Auth Middleware - Widget Query Params', () => {
  it('should authenticate from query parameters', async () => {
    const app = new Hono()
    app.use('*', authMiddleware)
    app.get('/test', (c) => {
      const user = c.get('telegramUser')
      const method = c.get('authMethod')
      return c.json({ user, method })
    })

    const res = await app.request('/test?hash=valid-hash&id=555555&auth_date=1234567890')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.method).toBe('widget')
    expect(json.user.id).toBe(555555)
  })
})
