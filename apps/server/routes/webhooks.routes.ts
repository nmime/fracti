import { Hono } from 'hono'
import type { Env } from '../types/api.types'
import { logger } from '../utils/logger'

const routes = new Hono<Env>()

// POST /api/webhooks/telegram - Telegram bot webhook endpoint
routes.post('/telegram', async (c) => {
  try {
    const update = await c.req.json()

    logger.info('Telegram webhook received', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
    })

    // Process the update (handled by bot app)
    // This endpoint just acknowledges receipt

    return c.json({ success: true })
  } catch (error) {
    logger.error('Webhook processing error', {}, error)
    return c.json({ success: false }, 500)
  }
})

export const webhooksRoutes = routes
