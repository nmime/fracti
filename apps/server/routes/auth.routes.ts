import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authController } from '../controllers';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { getGroupsByUser } from '@libs/db';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

const widgetDataSchema = z.record(z.string(), z.union([z.string(), z.number()]));

const initDataSchema = z.object({
  initData: z.string().min(1),
});

/**
 * Get user's wallet from any of their group memberships
 */
async function getUserWallet(telegramId: number): Promise<string | null> {
  const memberships = await getGroupsByUser(telegramId);
  // Find first membership with a wallet
  for (const m of memberships) {
    if (m.wallet) {
      return m.wallet;
    }
  }
  return null;
}

// GET /api/auth/me - Get current authenticated user
routes.get('/me', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  const authMethod = c.get('authMethod');

  // Get user's linked wallet
  const wallet = await getUserWallet(user.id);

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        photoUrl: user.photo_url,
        languageCode: user.language_code,
        isPremium: user.is_premium,
      },
      wallet,
      authMethod,
      authenticated: true,
    },
  });
});

// POST /api/auth/telegram-widget - Validate Telegram Login Widget
routes.post('/telegram-widget', zValidator('json', widgetDataSchema), async (c) => {
  const data = c.req.valid('json');

  return authController.validateWidgetData(c, data);
});

// POST /api/auth/init-data - Validate Mini App init data
routes.post('/init-data', zValidator('json', initDataSchema), async (c) => {
  const { initData } = c.req.valid('json');

  return authController.validateInitData(c, initData);
});

export const authRoutes = routes;
