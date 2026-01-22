import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: Context) => string
  message?: string
}

interface RateLimitStore {
  count: number
  resetTime: number
}

/**
 * Simple in-memory rate limiter for AWS Lambda.
 * Note: This uses in-memory storage, so it only works per Lambda instance.
 * For distributed rate limiting, use DynamoDB or Redis.
 */
const store = new Map<string, RateLimitStore>()

// Clean up old entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      store.delete(key)
    }
  }
}, 60000) // Clean every minute

// Prevent cleanup interval from keeping Lambda warm unnecessarily
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref()
}

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
  } = config

  return createMiddleware(async (c: Context, next: Next) => {
    const key = keyGenerator(c)
    const now = Date.now()

    let record = store.get(key)

    // If no record or window expired, start fresh
    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      }
      store.set(key, record)
    } else {
      record.count++
    }

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - record.count)
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000)

    c.header('X-RateLimit-Limit', String(maxRequests))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(resetSeconds))

    // Check if rate limit exceeded
    if (record.count > maxRequests) {
      c.header('Retry-After', String(resetSeconds))
      return c.json({ error: message }, 429)
    }

    return next()
  })
}

/**
 * Default key generator - uses IP address or Telegram user ID
 */
function defaultKeyGenerator(c: Context): string {
  // Try to get Telegram user ID from context (set by auth middleware)
  const telegramUser = c.get('telegramUser')
  if (telegramUser?.id) {
    return `user:${telegramUser.id}`
  }

  // Fall back to IP address
  const forwarded = c.req.header('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `ip:${ip}`
}

/**
 * Pre-configured rate limiters for different endpoints
 */

// Standard API rate limit: 100 requests per minute
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
})

// AI endpoint rate limit: 10 requests per minute (expensive operations)
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'AI parsing rate limit exceeded. Please wait before trying again.',
})

// Webhook rate limit: 1000 requests per minute (Telegram sends many updates)
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000,
})
