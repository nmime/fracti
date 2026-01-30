import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { recurringController } from '../controllers';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { groupIdParamSchema } from '../schemas';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

const templateIdParamSchema = z.object({
  groupId: z.string().min(1),
  templateId: z.string().min(1),
});

const createRecurringSchema = z.object({
  name: z.string().min(1),
  payerId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional(),
  description: z.string().min(1),
  splitType: z.enum(['equal', 'exact', 'percentage']).optional(),
  splits: z.array(
    z.object({
      userId: z.string().min(1),
      amount: z.number().optional(),
      percentage: z.number().optional(),
    }),
  ),
  category: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  monthOfYear: z.number().min(1).max(12).optional(),
  startDate: z.string().optional(),
});

// GET /api/groups/:groupId/recurring - Get all recurring templates for a group
routes.get('/:groupId/recurring', requireAuth, zValidator('param', groupIdParamSchema), async (c) => {
  const user = getCurrentUser(c);
  const { groupId } = c.req.valid('param');

  return recurringController.getAll(c, user, groupId);
});

// GET /api/groups/:groupId/recurring/due - Get due recurring templates for a group
routes.get('/:groupId/recurring/due', requireAuth, zValidator('param', groupIdParamSchema), async (c) => {
  const user = getCurrentUser(c);
  const { groupId } = c.req.valid('param');

  return recurringController.getDue(c, user, groupId);
});

// GET /api/groups/:groupId/recurring/:templateId - Get a specific recurring template
routes.get('/:groupId/recurring/:templateId', requireAuth, zValidator('param', templateIdParamSchema), async (c) => {
  const user = getCurrentUser(c);
  const { groupId, templateId } = c.req.valid('param');

  return recurringController.getOne(c, user, groupId, templateId);
});

// POST /api/groups/:groupId/recurring - Create a recurring template
routes.post(
  '/:groupId/recurring',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createRecurringSchema),
  async (c) => {
    const user = getCurrentUser(c);
    const { groupId } = c.req.valid('param');
    const input = c.req.valid('json');

    return recurringController.create(c, user, groupId, input);
  },
);

// DELETE /api/groups/:groupId/recurring/:templateId - Delete a recurring template
routes.delete('/:groupId/recurring/:templateId', requireAuth, zValidator('param', templateIdParamSchema), async (c) => {
  const user = getCurrentUser(c);
  const { groupId, templateId } = c.req.valid('param');

  return recurringController.delete(c, user, groupId, templateId);
});

export const recurringRoutes = routes;
