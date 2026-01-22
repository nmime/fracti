import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'crypto'

import type { Env } from '../lib/factory'
import {
  getExpenses,
  getSettlements,
  createSettlement,
  getGroup,
  getGroupMembers,
} from '../lib/dynamodb'
import { calculateBalances, optimizeSettlements, buildDebtGraph } from '../lib/debt-graph'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'
import {
  groupIdParamSchema,
  settlementIdParamSchema,
  createSettlementSchema,
  updateSettlementSchema,
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
      getExpenses(groupId),
      getSettlements(groupId),
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

// GET /api/groups/:groupId/settlements - List all settlements
settlementsRoutes.get(
  '/:groupId/settlements',
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const { groupId } = c.req.valid('param')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const [settlements, members] = await Promise.all([
      getSettlements(groupId),
      getGroupMembers(groupId),
    ])

    const userMap = new Map(members.map((m) => [m.id, m.name]))

    return c.json({
      success: true,
      data: settlements.map((s) => ({
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
    const telegramUser = c.get('telegramUser') || getDevUser()
    const { groupId } = c.req.valid('param')
    const { toId, amount, txHash } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const members = await getGroupMembers(groupId)
    const fromUserId = String(telegramUser.id)
    const fromMember = members.find((m) => m.id === fromUserId)
    const toMember = members.find((m) => m.id === toId)

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
      amount: Number(amount),
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
    const { groupId, settlementId } = c.req.valid('param')
    const { txHash, status } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const settlements = await getSettlements(groupId)
    const settlement = settlements.find((s) => s.id === settlementId)

    if (!settlement) {
      throw new HTTPException(404, { message: 'Settlement not found' })
    }

    // TODO: Actually update in DynamoDB using updateSettlementStatus
    return c.json({
      success: true,
      data: {
        ...settlement,
        txHash: txHash ?? settlement.txHash,
        status: status ?? settlement.status,
      },
    })
  }
)
