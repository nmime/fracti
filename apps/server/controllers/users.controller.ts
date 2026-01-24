import type { Context } from 'hono'
import { usersService } from '../services/users.service'
import { decodeCursor, encodeCursor } from '../utils/cursor'
import type { TelegramUser } from '../integrations/telegram'

export class UsersController {
  async getProfile(c: Context, user: TelegramUser) {
    const summary = await usersService.getUserSummary(user.id)

    return c.json({
      success: true,
      data: {
        id: String(user.id),
        name: [user.first_name, user.last_name].filter(Boolean).join(' '),
        username: user.username,
        summary,
      },
    })
  }

  async getGroups(c: Context, user: TelegramUser) {
    const balances = await usersService.getUserGroupBalances(user.id)

    return c.json({
      success: true,
      data: balances,
    })
  }

  async getExpenses(c: Context, user: TelegramUser, limit: number, cursor?: string) {
    const result = await usersService.getUserExpenses(user.id, {
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

  async getDebts(c: Context, user: TelegramUser) {
    const balances = await usersService.getUserGroupBalances(user.id)

    // Filter to only show groups where user has debt
    const debts = balances.filter((b) => b.balance < 0)

    return c.json({
      success: true,
      data: debts.map((d) => ({
        groupId: d.groupId,
        groupTitle: d.groupTitle,
        amount: Math.abs(d.balance),
        currency: d.currency,
      })),
    })
  }

  async getActivity(c: Context, user: TelegramUser, limit: number, cursor?: string) {
    // For now, return expenses as activity
    const result = await usersService.getUserExpenses(user.id, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    return c.json({
      success: true,
      data: result.items.map((e) => ({
        type: 'expense_paid' as const,
        id: e.id,
        groupId: e.groupId,
        amount: e.amount,
        description: e.description,
        createdAt: e.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }
}

export const usersController = new UsersController()
