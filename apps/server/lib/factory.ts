import { createFactory } from 'hono/factory'
import type { TelegramUser } from './telegram'

/**
 * Environment bindings for Hono context
 */
export type Env = {
  Bindings: {
    TABLE_NAME: string
    BEDROCK_MODEL_ID: string
    TELEGRAM_BOT_TOKEN: string
    MINI_APP_URL: string
    NODE_ENV: string
  }
  Variables: {
    telegramUser: TelegramUser | null
    isAuthenticated: boolean
    authMethod: 'init_data' | 'widget' | 'dev' | null
    requestId: string
  }
}

/**
 * Create factory with typed environment
 * This ensures consistent typing across all routes and middleware
 */
export const factory = createFactory<Env>()

/**
 * Create middleware with proper typing
 */
export const createMiddleware = factory.createMiddleware

/**
 * Create handlers with proper typing
 */
export const createHandlers = factory.createHandlers
