import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import {
  getExpenses,
  getSettlements,
  createSettlement,
  getGroup,
  getGroupMembers,
} from '../lib/dynamodb'
import { calculateDebts, optimizeSettlements, type Debt } from '../lib/debt-graph'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'

export const settlementsRoutes = new Hono()

// Apply auth middleware to all routes
settlementsRoutes.use('*', authMiddleware)

// GET /api/groups/:groupId/debts - Calculate current debts
settlementsRoutes.get('/:groupId/debts', async (c) => {
  const groupId = c.req.param('groupId')

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const [expenses, settlements, members] = await Promise.all([
    getExpenses(groupId),
    getSettlements(groupId),
    getGroupMembers(groupId),
  ])

  // Build user map with wallet addresses
  const userMap = new Map(
    members.map((m) => [m.id, { id: m.id, name: m.name, wallet: m.wallet }])
  )

  // Calculate debts
  const debts = calculateDebts(expenses, settlements)

  // Optimize settlements (min-cash-flow)
  const optimizedDebts = optimizeSettlements(debts)

  // Enrich with user info
  const enrichedDebts = optimizedDebts.map((d) => ({
    ...d,
    fromName: userMap.get(d.from)?.name ?? 'Unknown',
    fromWallet: userMap.get(d.from)?.wallet,
    toName: userMap.get(d.to)?.name ?? 'Unknown',
    toWallet: userMap.get(d.to)?.wallet,
  }))

  // Calculate balances per user
  const balances = new Map<string, number>()
  for (const member of members) {
    balances.set(member.id, 0)
  }

  for (const expense of expenses) {
    // Payer paid the full amount
    const current = balances.get(expense.payerId) ?? 0
    balances.set(expense.payerId, current + expense.amount)

    // Each split person owes their share
    for (const split of expense.splits) {
      const current = balances.get(split.userId) ?? 0
      balances.set(split.userId, current - split.amount)
    }
  }

  // Apply settlements
  for (const settlement of settlements) {
    const fromBalance = balances.get(settlement.fromId) ?? 0
    const toBalance = balances.get(settlement.toId) ?? 0
    balances.set(settlement.fromId, fromBalance + settlement.amount)
    balances.set(settlement.toId, toBalance - settlement.amount)
  }

  const balanceList = members.map((m) => ({
    userId: m.id,
    userName: m.name,
    wallet: m.wallet,
    balance: balances.get(m.id) ?? 0,
  }))

  return c.json({
    debts: enrichedDebts,
    balances: balanceList,
    summary: {
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
      totalSettled: settlements.reduce((sum, s) => sum + s.amount, 0),
      expenseCount: expenses.length,
      settlementCount: settlements.length,
    },
  })
})

// GET /api/groups/:groupId/settlements - List all settlements
settlementsRoutes.get('/:groupId/settlements', async (c) => {
  const groupId = c.req.param('groupId')

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const [settlements, members] = await Promise.all([
    getSettlements(groupId),
    getGroupMembers(groupId),
  ])

  const userMap = new Map(members.map((m) => [m.id, m.name]))

  return c.json(
    settlements.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      fromId: s.fromId,
      fromName: userMap.get(s.fromId) ?? 'Unknown',
      toId: s.toId,
      toName: userMap.get(s.toId) ?? 'Unknown',
      amount: s.amount,
      txHash: s.txHash,
      status: s.status,
      createdAt: s.createdAt,
    }))
  )
})

// POST /api/groups/:groupId/settlements - Record a settlement
settlementsRoutes.post('/:groupId/settlements', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const groupId = c.req.param('groupId')
  const body = await c.req.json()
  const { toId, amount, txHash } = body

  if (!toId || !amount) {
    return c.json(
      { error: 'Bad Request', message: 'Missing required fields: toId, amount' },
      400
    )
  }

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const members = await getGroupMembers(groupId)
  const fromId = String(telegramUser.id)
  const fromMember = members.find((m) => m.id === fromId)
  const toMember = members.find((m) => m.id === toId)

  if (!fromMember) {
    return c.json({ error: 'Bad Request', message: 'You are not a member of this group' }, 400)
  }

  if (!toMember) {
    return c.json({ error: 'Bad Request', message: 'Recipient not found in group' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()

  const settlement = await createSettlement({
    id,
    groupId,
    fromId,
    fromName: fromMember.name,
    toId,
    toName: toMember.name,
    amount: Number(amount),
    txHash: txHash || null,
    status: txHash ? 'confirmed' : 'pending',
    createdAt: now,
  })

  return c.json(settlement, 201)
})

// PUT /api/groups/:groupId/settlements/:settlementId - Update settlement (confirm tx)
settlementsRoutes.put('/:groupId/settlements/:settlementId', requireAuth, async (c) => {
  const groupId = c.req.param('groupId')
  const settlementId = c.req.param('settlementId')
  const body = await c.req.json()
  const { txHash, status } = body

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const settlements = await getSettlements(groupId)
  const settlement = settlements.find((s) => s.id === settlementId)

  if (!settlement) {
    return c.json({ error: 'Not Found', message: 'Settlement not found' }, 404)
  }

  // Update settlement (in a real app, you'd update the DynamoDB item)
  // For now, just return success
  return c.json({
    ...settlement,
    txHash: txHash ?? settlement.txHash,
    status: status ?? settlement.status,
  })
})
