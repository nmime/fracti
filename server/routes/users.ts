import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

import type { Env } from '../lib/factory'
import {
  getGroupsByUser,
  getGroup,
  getExpensesPaidByUser,
  getExpensesOwedByUser,
  getSettlementsByUser,
  getUserActivity,
  getUserSummary,
  type ExpenseRecord,
  type SettlementRecord,
} from '../lib/dynamodb'
import { authMiddleware, requireAuth, getCurrentUser } from '../middleware/auth'
import {
  paginationQuerySchema,
  decodeCursor,
  encodeCursor,
} from '../lib/schemas'

export const usersRoutes = new Hono<Env>()

// Apply auth middleware to all routes
usersRoutes.use('*', authMiddleware)

// GET /api/users/me - Get current user profile
usersRoutes.get('/me', requireAuth, async (c) => {
  const telegramUser = getCurrentUser(c)

  // Get all user's memberships to build profile
  const memberships = await getGroupsByUser(telegramUser.id)

  // Collect unique wallet addresses (user might have different wallets in different groups)
  const wallets = [...new Set(memberships.map((m) => m.wallet).filter(Boolean))]

  return c.json({
    success: true,
    data: {
      id: String(telegramUser.id),
      telegramId: telegramUser.id,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
      wallets,
      groupCount: memberships.length,
    },
  })
})

// GET /api/users/me/groups - Get all groups for current user
usersRoutes.get('/me/groups', requireAuth, async (c) => {
  const telegramUser = getCurrentUser(c)

  const memberships = await getGroupsByUser(telegramUser.id)

  // Fetch full group details for each membership
  const groupIds = memberships.map((m) => m.GSI1SK?.replace('GROUP#', '')).filter(Boolean) as string[]
  const groups = await Promise.all(groupIds.map((id) => getGroup(id)))

  return c.json({
    success: true,
    data: groups
      .filter(Boolean)
      .map((g) => ({
        id: g!.id,
        chatId: g!.chatId,
        title: g!.title,
        currency: g!.currency,
        createdAt: g!.createdAt,
        memberCount: g!.memberCount,
      })),
  })
})

// GET /api/users/me/expenses - Get expenses paid by current user (across all groups)
usersRoutes.get(
  '/me/expenses',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')

    const result = await getExpensesPaidByUser(telegramUser.id, {
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
        currency: e.currency,
        description: e.description,
        splitType: e.splitType,
        splits: e.splits,
        category: e.category,
        createdAt: e.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// GET /api/users/me/debts - Get expenses where user owes money (across all groups)
usersRoutes.get(
  '/me/debts',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')

    const result = await getExpensesOwedByUser(telegramUser.id, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    return c.json({
      success: true,
      data: result.items.map((p) => ({
        expenseId: p.expenseId,
        groupId: p.groupId,
        groupTitle: p.groupTitle,
        amount: p.amount,
        payerId: p.payerId,
        payerName: p.payerName,
        description: p.description,
        totalAmount: p.totalAmount,
        createdAt: p.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// GET /api/users/me/settlements - Get settlements made by current user (across all groups)
usersRoutes.get(
  '/me/settlements',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')

    const result = await getSettlementsByUser(telegramUser.id, {
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
        currency: s.currency,
        txHash: s.txHash,
        status: s.status,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// GET /api/users/me/activity - Get combined activity feed (expenses paid + settlements made)
usersRoutes.get(
  '/me/activity',
  requireAuth,
  zValidator('query', paginationQuerySchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { limit, cursor } = c.req.valid('query')

    const result = await getUserActivity(telegramUser.id, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    // Transform items into a unified activity format
    const activities = result.items.map((item) => {
      // Determine if this is an expense or settlement by checking for unique fields
      if ('splits' in item) {
        // This is an expense
        const expense = item as ExpenseRecord
        return {
          type: 'expense_paid' as const,
          id: expense.id,
          groupId: expense.groupId,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description,
          beneficiaries: expense.splits.map((s) => ({
            userId: s.userId,
            userName: s.userName,
            amount: s.amount,
          })),
          createdAt: expense.createdAt,
        }
      } else {
        // This is a settlement
        const settlement = item as SettlementRecord
        return {
          type: 'settlement_sent' as const,
          id: settlement.id,
          groupId: settlement.groupId,
          amount: settlement.amount,
          currency: settlement.currency,
          toUserId: settlement.toUserId,
          toUserName: settlement.toUserName,
          txHash: settlement.txHash,
          status: settlement.status,
          createdAt: settlement.createdAt,
          completedAt: settlement.completedAt,
        }
      }
    })

    return c.json({
      success: true,
      data: activities,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
)

// GET /api/users/me/summary - Get financial summary across all groups
usersRoutes.get('/me/summary', requireAuth, async (c) => {
  const telegramUser = getCurrentUser(c)

  const summary = await getUserSummary(telegramUser.id)

  return c.json({
    success: true,
    data: {
      totalPaid: summary.totalPaid,
      totalOwed: summary.totalOwed,
      netBalance: summary.netBalance,
      expensesPaidCount: summary.expensesPaidCount,
      expensesOwedCount: summary.expensesOwedCount,
      settlementsCount: summary.settlementsCount,
      groupCount: summary.groupCount,
    },
  })
})
