import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types/api.types'
import { analyticsController } from '../controllers/analytics.controller'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { groupIdParamSchema } from '../schemas'

const routes = new Hono<Env>()

// GET /api/groups/:groupId/analytics - Get full group analytics
routes.get(
  '/:groupId/analytics',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    return analyticsController.getGroupAnalytics(c, user, groupId)
  }
)

// GET /api/groups/:groupId/analytics/summary - Get summary statistics
routes.get(
  '/:groupId/analytics/summary',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    return analyticsController.getSummary(c, user, groupId)
  }
)

// GET /api/groups/:groupId/analytics/category - Get expenses by category
routes.get(
  '/:groupId/analytics/category',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    return analyticsController.getCategoryBreakdown(c, user, groupId)
  }
)

export const analyticsRoutes = routes
