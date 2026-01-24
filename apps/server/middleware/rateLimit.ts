import type { Context, Next, MiddlewareHandler } from 'hono'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: Context) => string
  message?: string
  /** Use sliding window algorithm instead of fixed window */
  slidingWindow?: boolean
  /** Skip rate limiting for certain conditions */
  skip?: (c: Context) => boolean
  /** Penalty multiplier for repeated violations (1.0 = no penalty) */
  penaltyMultiplier?: number
}

interface RateLimitStore {
  count: number
  resetTime: number
  lastAccess: number
  /** Timestamps for sliding window */
  timestamps?: number[]
  /** Number of violations for penalty tracking */
  violations?: number
}

/**
 * Maximum number of entries in the rate limit store.
 * Prevents unbounded memory growth in Lambda.
 */
const MAX_STORE_SIZE = 10000

/**
 * Simple in-memory rate limiter for AWS Lambda.
 * Note: This uses in-memory storage, so it only works per Lambda instance.
 * For distributed rate limiting, use DynamoDB or Redis.
 */
const store = new Map<string, RateLimitStore>()

/**
 * Evict oldest entries when store exceeds max size.
 * Uses LRU-like eviction based on lastAccess time.
 */
function evictOldEntries(): void {
  if (store.size <= MAX_STORE_SIZE) return

  const now = Date.now()
  const entriesToDelete: string[] = []

  // First pass: remove expired entries
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      entriesToDelete.push(key)
    }
  }

  for (const key of entriesToDelete) {
    store.delete(key)
  }

  // If still over limit, remove oldest entries
  if (store.size > MAX_STORE_SIZE) {
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)

    const toRemove = store.size - MAX_STORE_SIZE
    for (let i = 0; i < toRemove; i++) {
      store.delete(entries[i][0])
    }
  }
}

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
 * Clear the rate limit store (for testing only)
 */
export function _resetRateLimitStore(): void {
  store.clear()
}

/**
 * Calculate effective limit based on violations
 */
function getEffectiveLimit(
  maxRequests: number,
  violations: number,
  penaltyMultiplier: number
): number {
  if (penaltyMultiplier <= 1 || violations === 0) return maxRequests
  // Reduce limit by penalty factor for each violation
  const penalty = Math.pow(penaltyMultiplier, Math.min(violations, 5))
  return Math.max(1, Math.floor(maxRequests / penalty))
}

/**
 * Create rate limiting middleware with sliding window support
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
    slidingWindow = false,
    skip,
    penaltyMultiplier = 1,
  } = config

  return async (c: Context, next: Next) => {
    // Check skip condition
    if (skip?.(c)) {
      return next()
    }

    const key = keyGenerator(c)
    const now = Date.now()

    let record = store.get(key)
    let effectiveLimit = maxRequests

    if (slidingWindow) {
      // Sliding window algorithm - more accurate rate limiting
      if (!record) {
        evictOldEntries()
        record = {
          count: 1,
          resetTime: now + windowMs,
          lastAccess: now,
          timestamps: [now],
          violations: 0,
        }
        store.set(key, record)
      } else {
        // Remove timestamps outside the window
        const windowStart = now - windowMs
        record.timestamps = (record.timestamps || []).filter(t => t > windowStart)
        record.timestamps.push(now)
        record.count = record.timestamps.length
        record.lastAccess = now
        record.resetTime = now + windowMs

        // Calculate effective limit with penalties
        effectiveLimit = getEffectiveLimit(maxRequests, record.violations || 0, penaltyMultiplier)
      }
    } else {
      // Fixed window algorithm (original behavior)
      if (!record || record.resetTime < now) {
        evictOldEntries()
        // Carry over violations from previous window
        const previousViolations = record?.violations || 0
        record = {
          count: 1,
          resetTime: now + windowMs,
          lastAccess: now,
          violations: previousViolations > 0 ? previousViolations - 1 : 0, // Decay violations
        }
        store.set(key, record)
      } else {
        record.count++
        record.lastAccess = now
      }

      effectiveLimit = getEffectiveLimit(maxRequests, record.violations || 0, penaltyMultiplier)
    }

    // Set rate limit headers
    const remaining = Math.max(0, effectiveLimit - record.count)
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000)

    c.header('X-RateLimit-Limit', String(effectiveLimit))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset', String(resetSeconds))
    c.header('X-RateLimit-Policy', `${maxRequests};w=${Math.floor(windowMs / 1000)}`)

    // Check if rate limit exceeded
    if (record.count > effectiveLimit) {
      // Track violation
      record.violations = (record.violations || 0) + 1

      c.header('Retry-After', String(resetSeconds))
      return c.json(
        {
          error: message,
          retryAfter: resetSeconds,
          limit: effectiveLimit,
        },
        429
      )
    }

    return next()
  }
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

// Standard API rate limit: 100 requests per minute with sliding window
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
  slidingWindow: true,
  penaltyMultiplier: 1.5, // Reduce limit by 1.5x per violation
})

// Strict API rate limit: 30 requests per minute for sensitive endpoints
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  slidingWindow: true,
  penaltyMultiplier: 2, // Reduce limit by 2x per violation
  message: 'Rate limit exceeded for sensitive operation. Please wait before trying again.',
})

// AI endpoint rate limit: 10 requests per minute (expensive operations)
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  slidingWindow: true,
  penaltyMultiplier: 2.5, // More aggressive penalty for AI abuse
  message: 'AI parsing rate limit exceeded. Please wait before trying again.',
})

// Webhook rate limit: 1000 requests per minute (Telegram sends many updates)
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000,
  slidingWindow: false, // Fixed window is fine for webhooks
})

// Burst rate limit: Allow short bursts but limit sustained traffic
export const burstRateLimit = rateLimit({
  windowMs: 10 * 1000, // 10 second window
  maxRequests: 20, // 20 requests per 10 seconds
  slidingWindow: true,
  message: 'Too many requests in a short period. Please slow down.',
})
