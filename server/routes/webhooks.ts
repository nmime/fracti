import { Hono } from 'hono'
import { handleUpdate } from '../lib/bot'

export const webhooksRoutes = new Hono()

// POST /api/webhooks/telegram - Telegram bot webhook (Grammy)
webhooksRoutes.post('/telegram', async (c) => {
  try {
    // Grammy's webhookCallback expects a standard Request/Response
    const request = c.req.raw
    const response = await handleUpdate(request)

    // Copy response to Hono context
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    // Always return 200 to prevent Telegram retries
    return c.json({ ok: false, error: String(error) })
  }
})
