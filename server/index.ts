import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timing } from 'hono/timing'
import { secureHeaders } from 'hono/secure-headers'
import { requestId } from 'hono/request-id'
import { compress } from 'hono/compress'
import { HTTPException } from 'hono/http-exception'
import { handle } from 'hono/aws-lambda'
import { ZodError } from 'zod'

import type { Env } from './lib/factory'
import { isDevelopment, getAllowedOrigins } from './lib/config'
import { groupsRoutes } from './routes/groups'
import { expensesRoutes } from './routes/expenses'
import { settlementsRoutes } from './routes/settlements'
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
    contentSecurityPolicy: isDevelopment ? false : {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://telegram.org'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.telegram.org', 'https://tonapi.io'],
    },
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
  })
)

// Compression for responses
app.use('*', compress())

// Logger
app.use('*', logger())

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

// Groups API
app.route('/api/groups', groupsRoutes)

// Expenses API (nested under groups)
app.route('/api/groups', expensesRoutes)

// Settlements API (nested under groups)
app.route('/api/groups', settlementsRoutes)

// AI API
app.route('/api/ai', aiRoutes)

// Webhooks (Telegram bot)
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
  console.error('Unhandled error:', {
    requestId: reqId,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

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
