import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../types/api.types'
import { expensesController } from '../controllers/expenses.controller'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import {
  groupIdParamSchema,
  expenseIdParamSchema,
  createExpenseSchema,
  paginationQuerySchema,
} from '../schemas'

const routes = new Hono<Env>()

// GET /api/groups/:groupId/expenses - List expenses for a group
routes.get(
  '/:groupId/expenses',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { limit, cursor } = c.req.valid('query')
    return expensesController.list(c, user, groupId, limit, cursor)
  }
)

// GET /api/groups/:groupId/expenses/:expenseId - Get single expense
routes.get(
  '/:groupId/expenses/:expenseId',
  requireAuth,
  zValidator('param', expenseIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId, expenseId } = c.req.valid('param')
    return expensesController.getById(c, user, groupId, expenseId)
  }
)

// POST /api/groups/:groupId/expenses - Create a new expense
routes.post(
  '/:groupId/expenses',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createExpenseSchema),
  async (c) => {
    const { groupId } = c.req.valid('param')
    const body = c.req.valid('json')
    return expensesController.create(c, groupId, body)
  }
)

// DELETE /api/groups/:groupId/expenses/:expenseId - Delete an expense
routes.delete(
  '/:groupId/expenses/:expenseId',
  requireAuth,
  zValidator('param', expenseIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId, expenseId } = c.req.valid('param')
    return expensesController.delete(c, user, groupId, expenseId)
  }
)

export const expensesRoutes = routes
