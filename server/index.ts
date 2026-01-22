import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { handle } from 'hono/aws-lambda'

import { groupsRoutes } from './routes/groups'
import { expensesRoutes } from './routes/expenses'
import { settlementsRoutes } from './routes/settlements'
import { aiRoutes } from './routes/ai'
import { webhooksRoutes } from './routes/webhooks'
import { authMiddleware } from './middleware/auth'

// Create main Hono app
const app = new Hono()

// Global middleware
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization'],
  })
)

// Health check
app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'fracti-api',
  })
)

// Mount routes
app.route('/api/groups', groupsRoutes)
app.route('/api/groups', expensesRoutes)
app.route('/api/groups', settlementsRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/webhooks', webhooksRoutes)

// 404 handler
app.notFound((c) =>
  c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  )
)

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  )
})

// Export for AWS Lambda
export const handler = handle(app)

// Export app for testing
export { app }
