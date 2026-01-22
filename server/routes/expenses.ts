import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import {
  getExpenses,
  createExpense,
  deleteExpense,
  getGroup,
  getGroupMembers,
} from '../lib/dynamodb'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'

export const expensesRoutes = new Hono()

// Apply auth middleware to all routes
expensesRoutes.use('*', authMiddleware)

// GET /api/groups/:groupId/expenses - List expenses for a group
expensesRoutes.get('/:groupId/expenses', async (c) => {
  const groupId = c.req.param('groupId')

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const expenses = await getExpenses(groupId)

  return c.json(
    expenses.map((e) => ({
      id: e.id,
      groupId: e.groupId,
      payerId: e.payerId,
      payerName: e.payerName,
      amount: e.amount,
      description: e.description,
      splitType: e.splitType,
      splits: e.splits,
      createdAt: e.createdAt,
    }))
  )
})

// POST /api/groups/:groupId/expenses - Create a new expense
expensesRoutes.post('/:groupId/expenses', requireAuth, async (c) => {
  const groupId = c.req.param('groupId')
  const body = await c.req.json()
  const { payerId, amount, description, splitType, splits } = body

  // Validate required fields
  if (!payerId || !amount || !description || !splits) {
    return c.json(
      { error: 'Bad Request', message: 'Missing required fields: payerId, amount, description, splits' },
      400
    )
  }

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  // Get members to resolve names
  const members = await getGroupMembers(groupId)
  const memberMap = new Map(members.map((m) => [m.id, m]))

  const payer = memberMap.get(payerId)
  if (!payer) {
    return c.json({ error: 'Bad Request', message: 'Payer not found in group' }, 400)
  }

  const id = randomUUID()
  const now = new Date().toISOString()

  const expense = await createExpense({
    id,
    groupId,
    payerId,
    payerName: payer.name,
    amount: Number(amount),
    description,
    splitType: splitType || 'equal',
    splits: splits.map((s: { userId: string; amount?: number }) => {
      const member = memberMap.get(s.userId)
      return {
        userId: s.userId,
        userName: member?.name ?? 'Unknown',
        amount: s.amount ?? amount / splits.length,
      }
    }),
    createdAt: now,
  })

  return c.json(expense, 201)
})

// GET /api/groups/:groupId/expenses/:expenseId - Get single expense
expensesRoutes.get('/:groupId/expenses/:expenseId', async (c) => {
  const groupId = c.req.param('groupId')
  const expenseId = c.req.param('expenseId')

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const expenses = await getExpenses(groupId)
  const expense = expenses.find((e) => e.id === expenseId)

  if (!expense) {
    return c.json({ error: 'Not Found', message: 'Expense not found' }, 404)
  }

  return c.json(expense)
})

// DELETE /api/groups/:groupId/expenses/:expenseId - Delete an expense
expensesRoutes.delete('/:groupId/expenses/:expenseId', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const groupId = c.req.param('groupId')
  const expenseId = c.req.param('expenseId')

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const expenses = await getExpenses(groupId)
  const expense = expenses.find((e) => e.id === expenseId)

  if (!expense) {
    return c.json({ error: 'Not Found', message: 'Expense not found' }, 404)
  }

  // Only allow payer or admin to delete (for now, just check if it's the payer)
  if (expense.payerId !== String(telegramUser.id) && !c.get('isAuthenticated')) {
    return c.json({ error: 'Forbidden', message: 'Only the payer can delete this expense' }, 403)
  }

  await deleteExpense(groupId, expense.createdAt)

  return c.json({ success: true, message: 'Expense deleted' })
})
