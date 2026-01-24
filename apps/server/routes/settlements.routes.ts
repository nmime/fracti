import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../types/api.types'
import { settlementsController } from '../controllers/settlements.controller'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import {
  groupIdParamSchema,
  settlementIdParamSchema,
  createSettlementSchema,
  updateSettlementSchema,
  paginationQuerySchema,
  txHash,
} from '../schemas'

const routes = new Hono<Env>()

// GET /api/groups/:groupId/debts - Calculate optimized debts
routes.get(
  '/:groupId/debts',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    return settlementsController.getDebts(c, user, groupId)
  }
)

// GET /api/groups/:groupId/settlements - List settlements
routes.get(
  '/:groupId/settlements',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { limit, cursor } = c.req.valid('query')
    return settlementsController.list(c, user, groupId, limit, cursor)
  }
)

// GET /api/groups/:groupId/settlements/:settlementId - Get single settlement
routes.get(
  '/:groupId/settlements/:settlementId',
  requireAuth,
  zValidator('param', settlementIdParamSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId, settlementId } = c.req.valid('param')
    return settlementsController.getById(c, user, groupId, settlementId)
  }
)

// POST /api/groups/:groupId/settlements - Create a new settlement
routes.post(
  '/:groupId/settlements',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createSettlementSchema),
  async (c) => {
    const user = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { toId, amount, txHash } = c.req.valid('json')
    return settlementsController.create(c, user, groupId, toId, amount, txHash)
  }
)

// PUT /api/groups/:groupId/settlements/:settlementId - Update a settlement
routes.put(
  '/:groupId/settlements/:settlementId',
  requireAuth,
  zValidator('param', settlementIdParamSchema),
  zValidator('json', updateSettlementSchema),
  async (c) => {
    const { groupId, settlementId } = c.req.valid('param')
    const { status, txHash } = c.req.valid('json')
    return settlementsController.update(c, groupId, settlementId, status, txHash)
  }
)

// POST /api/groups/:groupId/settlements/:settlementId/verify-payment - Verify payment
routes.post(
  '/:groupId/settlements/:settlementId/verify-payment',
  requireAuth,
  zValidator('param', settlementIdParamSchema),
  zValidator('json', z.object({ txHash })),
  async (c) => {
    const { groupId, settlementId } = c.req.valid('param')
    const { txHash } = c.req.valid('json')
    return settlementsController.verifyPayment(c, groupId, settlementId, txHash)
  }
)

export const settlementsRoutes = routes
