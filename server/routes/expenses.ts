import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'crypto'

import type { Env } from '../lib/factory'
import {
  getExpenses,
  getAllExpenses,
  createExpense,
  deleteExpense,
  getGroup,
  getGroupMembers,
} from '../lib/dynamodb'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'
import {
  groupIdParamSchema,
  expenseIdParamSchema,
  createExpenseSchema,
  paginationQuerySchema,
  decodeCursor,
  encodeCursor,
} from '../lib/schemas'

export const expensesRoutes = new Hono<Env>()

// Apply auth middleware to all routes
expensesRoutes.use('*', authMiddleware)

// GET /api/groups/:groupId/expenses - List expenses for a group (paginated)
expensesRoutes.get(
  '/:groupId/expenses',
  zValidator('param', groupIdParamSchema),
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const { groupId } = c.req.valid('param')
    const { limit, cursor } = c.req.valid('query')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const result = await getExpenses(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    return c.json({
      success: true,
      data: result.items.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        payerId: e.payerId,
        payerName: e.payerName,
        amount: e.amount,
        description: e.description,
        splitType: e.splitType,
        splits: e.splits,
        createdAt: e.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// POST /api/groups/:groupId/expenses - Create a new expense
expensesRoutes.post(
  '/:groupId/expenses',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createExpenseSchema),
  async (c) => {
    const { groupId } = c.req.valid('param')
    const { payerId, amount, description, splitType, splits } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Get members to resolve names
    const members = await getGroupMembers(groupId)
    const memberMap = new Map(members.map((m) => [m.id, m]))

    const payer = memberMap.get(payerId)
    if (!payer) {
      throw new HTTPException(400, { message: 'Payer not found in group' })
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
      splits: splits.map((s) => {
        const member = memberMap.get(s.userId)
        return {
          userId: s.userId,
          userName: member?.name ?? 'Unknown',
          amount: s.amount ?? amount / splits.length,
        }
      }),
      createdAt: now,
    })

    return c.json({ success: true, data: expense }, 201)
  }
)

// GET /api/groups/:groupId/expenses/:expenseId - Get single expense
expensesRoutes.get(
  '/:groupId/expenses/:expenseId',
  zValidator('param', expenseIdParamSchema),
  async (c) => {
    const { groupId, expenseId } = c.req.valid('param')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Note: For single expense lookup, we need to scan all expenses
    // Consider adding a GSI on expense ID for more efficient lookups
    const expenses = await getAllExpenses(groupId)
    const expense = expenses.find((e) => e.id === expenseId)

    if (!expense) {
      throw new HTTPException(404, { message: 'Expense not found' })
    }

    return c.json({ success: true, data: expense })
  }
)

// DELETE /api/groups/:groupId/expenses/:expenseId - Delete an expense
expensesRoutes.delete(
  '/:groupId/expenses/:expenseId',
  requireAuth,
  zValidator('param', expenseIdParamSchema),
  async (c) => {
    const telegramUser = c.get('telegramUser') || getDevUser()
    const { groupId, expenseId } = c.req.valid('param')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Note: For single expense lookup, we need to scan all expenses
    // Consider adding a GSI on expense ID for more efficient lookups
    const expenses = await getAllExpenses(groupId)
    const expense = expenses.find((e) => e.id === expenseId)

    if (!expense) {
      throw new HTTPException(404, { message: 'Expense not found' })
    }

    // Only allow payer to delete
    if (expense.payerId !== String(telegramUser.id)) {
      throw new HTTPException(403, { message: 'Only the payer can delete this expense' })
    }

    await deleteExpense(groupId, expense.createdAt)

    return c.json({ success: true, message: 'Expense deleted' })
  }
)
