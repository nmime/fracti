import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'crypto'

import type { Env } from '../lib/factory'
import {
  getAllExpenses,
  getAllSettlements,
  getSettlements,
  getSettlementById,
  createSettlement,
  updateSettlementStatus,
  getGroup,
  getGroupMembers,
} from '../lib/dynamodb'
import { calculateBalances, optimizeSettlements, buildDebtGraph } from '../lib/debt-graph'
import { authMiddleware, requireAuth, getCurrentUser } from '../middleware/auth'
import { createMemberMap } from '../lib/utils'
import {
  groupIdParamSchema,
  settlementIdParamSchema,
  createSettlementSchema,
  updateSettlementSchema,
  paginationQuerySchema,
  decodeCursor,
  encodeCursor,
} from '../lib/schemas'

export const settlementsRoutes = new Hono<Env>()

// Apply auth middleware to all routes
settlementsRoutes.use('*', authMiddleware)

// GET /api/groups/:groupId/debts - Calculate current debts
settlementsRoutes.get(
  '/:groupId/debts',
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const { groupId } = c.req.valid('param')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const [expenses, settlements, members] = await Promise.all([
      getAllExpenses(groupId),
      getAllSettlements(groupId),
      getGroupMembers(groupId),
    ])

    // Calculate balances using the debt-graph library
    const balances = calculateBalances(expenses, settlements, members)

    // Build the debt graph
    const debtGraph = buildDebtGraph(balances, members)

    // Optimize settlements (min-cash-flow algorithm)
    const optimizedSettlements = optimizeSettlements(balances, members)

    return c.json({
      success: true,
      data: {
        graph: debtGraph,
        suggestedSettlements: optimizedSettlements,
        balances: debtGraph.nodes,
        summary: {
          totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
          totalSettled: settlements.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.amount, 0),
          expenseCount: expenses.length,
          settlementCount: settlements.length,
          pendingSettlements: settlements.filter(s => s.status === 'pending').length,
        },
      },
    })
  }
)

// GET /api/groups/:groupId/settlements - List settlements (paginated)
settlementsRoutes.get(
  '/:groupId/settlements',
  zValidator('param', groupIdParamSchema),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const { groupId } = c.req.valid('param')
    const { limit, cursor } = c.req.valid('query')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const result = await getSettlements(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    return c.json({
      success: true,
      data: result.items.map((s) => ({
        id: s.id,
        groupId: s.groupId,
        fromUserId: s.fromUserId,
        fromUserName: s.fromUserName,
        toUserId: s.toUserId,
        toUserName: s.toUserName,
        amount: s.amount,
        txHash: s.txHash,
        status: s.status,
        createdAt: s.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// POST /api/groups/:groupId/settlements - Record a settlement
settlementsRoutes.post(
  '/:groupId/settlements',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createSettlementSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { toId, amount, txHash } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const members = await getGroupMembers(groupId)
    const memberMap = createMemberMap(members)
    const fromUserId = String(telegramUser.id)
    const fromMember = memberMap.get(fromUserId)
    const toMember = memberMap.get(toId)

    if (!fromMember) {
      throw new HTTPException(400, { message: 'You are not a member of this group' })
    }

    if (!toMember) {
      throw new HTTPException(400, { message: 'Recipient not found in group' })
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    const settlement = await createSettlement({
      id,
      groupId,
      fromUserId,
      fromUserName: fromMember.name,
      toUserId: toId,
      toUserName: toMember.name,
      amount,
      txHash: txHash || undefined,
      status: txHash ? 'completed' : 'pending',
      createdAt: now,
    })

    return c.json({ success: true, data: settlement }, 201)
  }
)

// PUT /api/groups/:groupId/settlements/:settlementId - Update settlement (confirm tx)
settlementsRoutes.put(
  '/:groupId/settlements/:settlementId',
  requireAuth,
  zValidator('param', settlementIdParamSchema),
  zValidator('json', updateSettlementSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId, settlementId } = c.req.valid('param')
    const { txHash, status } = c.req.valid('json')

    // Use GSI2 for O(1) lookup by settlement ID
    const settlement = await getSettlementById(settlementId)

    if (!settlement) {
      throw new HTTPException(404, { message: 'Settlement not found' })
    }

    // Verify settlement belongs to the requested group
    if (settlement.groupId !== groupId) {
      throw new HTTPException(404, { message: 'Settlement not found in this group' })
    }

    // Verify the user is the sender of the settlement
    if (settlement.fromUserId !== String(telegramUser.id)) {
      throw new HTTPException(403, { message: 'You can only update your own settlements' })
    }

    // Prevent updating completed/failed settlements
    if (settlement.status !== 'pending') {
      throw new HTTPException(400, { message: 'Cannot update a non-pending settlement' })
    }

    // Update the settlement in DynamoDB
    const newStatus = status ?? (txHash ? 'completed' : settlement.status)
    await updateSettlementStatus(groupId, settlement.createdAt, newStatus, txHash)

    return c.json({
      success: true,
      data: {
        ...settlement,
        txHash: txHash ?? settlement.txHash,
        status: newStatus,
      },
    })
  }
)
