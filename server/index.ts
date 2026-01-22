import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { timing } from 'hono/timing'
import { secureHeaders } from 'hono/secure-headers'
import { requestId } from 'hono/request-id'
import { compress } from 'hono/compress'
import { HTTPException } from 'hono/http-exception'
import { handle } from 'hono/aws-lambda'
import { ZodError } from 'zod'

import type { Env } from './lib/factory'
import { isDevelopment, getAllowedOrigins } from './lib/config'
import { logger } from './lib/logger'
import { standardRateLimit, aiRateLimit, webhookRateLimit } from './middleware/rateLimit'
import { groupsRoutes } from './routes/groups'
import { expensesRoutes } from './routes/expenses'
import { settlementsRoutes } from './routes/settlements'
import { usersRoutes } from './routes/users'
import { analyticsRoutes } from './routes/analytics'
import { recurringRoutes } from './routes/recurring'
import { aiRoutes } from './routes/ai'
import { webhooksRoutes } from './routes/webhooks'

// Create main Hono app with typed environment
const app = new Hono<Env>()

// ============================================
// Global Middleware
// ============================================

// Request ID for tracing
app.use('*', requestId())

// Timing headers (useful for debugging)
app.use('*', timing())

// Security headers
app.use(
  '*',
  secureHeaders({
    // Disable CSP in development, enable in production
    ...(isDevelopment ? {} : {
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://telegram.org'],
        // Use nonce for styles in production - for now allow inline with strict CSP
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.telegram.org', 'https://tonapi.io'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", 'https://web.telegram.org'],
      },
      // HSTS: enforce HTTPS for 1 year, include subdomains
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    }),
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'SAMEORIGIN', // Allow Telegram iframe
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
)

// Compression for responses
app.use('*', compress())

// Logger (Hono request logger)
app.use('*', honoLogger())

// CORS - restricted in production
app.use(
  '*',
  cors({
    origin: getAllowedOrigins(),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'X-Telegram-Init-Data',
      'X-Telegram-Widget-Data',
      'Authorization',
    ],
    exposeHeaders: ['X-Request-Id', 'Server-Timing'],
    maxAge: 86400,
    credentials: true,
  })
)

// ============================================
// Health Check
// ============================================

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'fracti-api',
      version: '1.0.0',
      requestId: c.get('requestId'),
    },
  })
})

// ============================================
// Mount Routes
// ============================================

// Groups API - standard rate limit
app.use('/api/groups/*', standardRateLimit)
app.route('/api/groups', groupsRoutes)

// Expenses API (nested under groups) - already covered by /api/groups/*
app.route('/api/groups', expensesRoutes)

// Settlements API (nested under groups) - already covered by /api/groups/*
app.route('/api/groups', settlementsRoutes)

// Analytics API (nested under groups) - already covered by /api/groups/*
app.route('/api/groups', analyticsRoutes)

// Recurring templates API (nested under groups) - already covered by /api/groups/*
app.route('/api/groups', recurringRoutes)

// Users API - user-centric queries (personal expenses, debts, settlements)
app.use('/api/users/*', standardRateLimit)
app.route('/api/users', usersRoutes)

// AI API - stricter rate limit (expensive operations)
app.use('/api/ai/*', aiRateLimit)
app.route('/api/ai', aiRoutes)

// Webhooks (Telegram bot) - higher rate limit
app.use('/api/webhooks/*', webhookRateLimit)
app.route('/api/webhooks', webhooksRoutes)

// ============================================
// Error Handling
// ============================================

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      requestId: c.get('requestId'),
    },
    404
  )
})

// Global error handler
app.onError((err, c) => {
  const reqId = c.get('requestId')

  // Handle HTTPException (intentional errors)
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: err.message || 'Error',
        message: err.cause instanceof Error ? err.cause.message : undefined,
        requestId: reqId,
      },
      err.status
    )
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: 'Validation Error',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        requestId: reqId,
      },
      400
    )
  }

  // Log unexpected errors
  logger.error('Unhandled error', {
    requestId: reqId,
    path: c.req.path,
    method: c.req.method,
  }, err)

  // Return generic error in production
  return c.json(
    {
      success: false,
      error: 'Internal Server Error',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      stack: isDevelopment ? err.stack : undefined,
      requestId: reqId,
    },
    500
  )
})

// ============================================
// AWS Lambda Export
// ============================================

export const handler = handle(app)

// Export app for testing
export { app }

// Export types
export type { Env }
