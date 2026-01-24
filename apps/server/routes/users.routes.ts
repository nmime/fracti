import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types/api.types'
import { usersController } from '../controllers/users.controller'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { paginationQuerySchema } from '../schemas'

const routes = new Hono<Env>()

// GET /api/users/me - Get current user profile
routes.get('/me', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  return usersController.getProfile(c, user)
})

// GET /api/users/me/groups - Get all groups with balances
routes.get('/me/groups', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  return usersController.getGroups(c, user)
})

// GET /api/users/me/expenses - Get user's expenses
routes.get(
  '/me/expenses',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')
    return usersController.getExpenses(c, user, limit, cursor)
  }
)

// GET /api/users/me/debts - Get user's debts across all groups
routes.get('/me/debts', requireAuth, async (c) => {
  const user = getCurrentUser(c)
  return usersController.getDebts(c, user)
})

// GET /api/users/me/activity - Get user activity timeline
routes.get(
  '/me/activity',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')
    return usersController.getActivity(c, user, limit, cursor)
  }
)

export const usersRoutes = routes
