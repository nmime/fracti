import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { usersController } from '../controllers';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { paginationQuerySchema, updateLanguageSchema } from '../schemas';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

// GET /api/users/me - Get current user profile
routes.get('/me', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return usersController.getProfile(c, user);
});

// GET /api/users/me/groups - Get all groups with balances
routes.get('/me/groups', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return usersController.getGroups(c, user);
});

// GET /api/users/me/expenses - Get user's expenses
routes.get('/me/expenses', requireAuth, zValidator('query', paginationQuerySchema), async (c) => {
  const user = getCurrentUser(c);
  const { limit, cursor } = c.req.valid('query');

  return usersController.getExpenses(c, user, limit, cursor);
});

// GET /api/users/me/debts - Get user's debts across all groups
routes.get('/me/debts', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return usersController.getDebts(c, user);
});

// GET /api/users/me/settlements - Get user's settlements
routes.get('/me/settlements', requireAuth, zValidator('query', paginationQuerySchema), async (c) => {
  const user = getCurrentUser(c);
  const { limit, cursor } = c.req.valid('query');

  return usersController.getSettlements(c, user, limit, cursor);
});

// GET /api/users/me/activity - Get user activity timeline
routes.get('/me/activity', requireAuth, zValidator('query', paginationQuerySchema), async (c) => {
  const user = getCurrentUser(c);
  const { limit, cursor } = c.req.valid('query');

  return usersController.getActivity(c, user, limit, cursor);
});

// GET /api/users/me/summary - Get user summary for analytics
routes.get('/me/summary', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return usersController.getSummary(c, user);
});

// GET /api/users/me/language - Get user language preference
routes.get('/me/language', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return usersController.getLanguage(c, user);
});

// PUT /api/users/me/language - Update user language preference
routes.put('/me/language', requireAuth, zValidator('json', updateLanguageSchema), async (c) => {
  const user = getCurrentUser(c);
  const { languageCode } = c.req.valid('json');

  return usersController.updateLanguage(c, user, languageCode);
});

export const usersRoutes = routes;
