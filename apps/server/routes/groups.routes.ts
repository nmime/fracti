import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { groupsController } from '../controllers';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import {
  groupIdParamSchema,
  createGroupSchema,
  joinGroupSchema,
  updateWalletSchema,
  paginationQuerySchema,
} from '../schemas';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

// GET /api/groups - List groups for current user
routes.get('/', requireAuth, async (c) => {
  const user = getCurrentUser(c);

  return groupsController.list(c, user);
});

// GET /api/groups/:groupId - Get single group with members
routes.get('/:groupId', requireAuth, zValidator('param', groupIdParamSchema), async (c) => {
  const { groupId } = c.req.valid('param');

  return groupsController.getById(c, groupId);
});

// GET /api/groups/:groupId/activity - Get group activity timeline
routes.get(
  '/:groupId/activity',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const user = getCurrentUser(c);
    const { groupId } = c.req.valid('param');
    const { limit, cursor } = c.req.valid('query');

    return groupsController.getActivity(c, user, groupId, limit, cursor);
  },
);

// POST /api/groups - Create new group
routes.post('/', requireAuth, zValidator('json', createGroupSchema), async (c) => {
  const user = getCurrentUser(c);
  const { title, chatId } = c.req.valid('json');

  return groupsController.create(c, user, title, chatId);
});

// POST /api/groups/:groupId/join - Join a group
routes.post(
  '/:groupId/join',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', joinGroupSchema),
  async (c) => {
    const user = getCurrentUser(c);
    const { groupId } = c.req.valid('param');
    const { wallet } = c.req.valid('json');

    return groupsController.join(c, user, groupId, wallet);
  },
);

// PUT /api/groups/:groupId/wallet - Update wallet address
routes.put(
  '/:groupId/wallet',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', updateWalletSchema),
  async (c) => {
    const user = getCurrentUser(c);
    const { groupId } = c.req.valid('param');
    const { wallet } = c.req.valid('json');

    return groupsController.updateWallet(c, user, groupId, wallet);
  },
);

export const groupsRoutes = routes;
