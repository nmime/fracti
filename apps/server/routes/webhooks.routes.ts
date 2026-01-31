import { Hono } from 'hono';
import { logger } from '../utils/logger';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

// POST /api/webhooks/telegram - Telegram bot webhook endpoint
// Used by AWS Lambda - Docker uses polling mode via bot container
routes.post('/telegram', async (c) => {
  try {
    const update = await c.req.json();

    logger.info('Telegram webhook received', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallbackQuery: !!update.callback_query,
    });

    // In AWS Lambda, this is handled by the bot Lambda function
    // In Docker, bot runs in polling mode (separate container)
    // This endpoint just acknowledges receipt for Lambda proxy

    return c.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', {}, error);

    return c.json({ success: false }, 500);
  }
});

export const webhooksRoutes = routes;
