import { membersRepository } from '../repositories/members.repository'
import { expensesRepository } from '../repositories/expenses.repository'
import { settlementsRepository } from '../repositories/settlements.repository'
import { groupsRepository } from '../repositories/groups.repository'
import type { PaginationOptions, PaginatedResult, ExpenseRecord, UserExpenseSummary } from '../types/db.types'

export interface UserGroupBalance {
  groupId: string
  groupTitle: string
  balance: number
  currency?: string
}

class UsersService {
  async getUserSummary(telegramId: number): Promise<UserExpenseSummary> {
    const memberships = await membersRepository.findGroupsByUser(telegramId)
    const groupCount = memberships.items.length

    // Fetch all expenses and settlements for the user
    let totalPaid = 0
    let totalOwed = 0
    let expensesPaidCount = 0
    let expensesOwedCount = 0
    let settlementsCount = 0
    let settledAmount = 0

    // Get expenses paid by user
    let lastPaidKey: Record<string, unknown> | undefined
    do {
      const result = await expensesRepository.findPaidByUser(telegramId, { lastKey: lastPaidKey })
      totalPaid += result.items.reduce((sum, e) => sum + e.amount, 0)
      expensesPaidCount += result.items.length
      lastPaidKey = result.lastKey
    } while (lastPaidKey)

    // Get expenses owed by user
    let lastOwedKey: Record<string, unknown> | undefined
    do {
      const result = await expensesRepository.findOwedByUser(telegramId, { lastKey: lastOwedKey })
      totalOwed += result.items.reduce((sum, e) => sum + e.amount, 0)
      expensesOwedCount += result.items.length
      lastOwedKey = result.lastKey
    } while (lastOwedKey)

    // Get settlements by user
    let lastSettlementKey: Record<string, unknown> | undefined
    do {
      const result = await settlementsRepository.findByUser(telegramId, { lastKey: lastSettlementKey })
      settlementsCount += result.items.length
      settledAmount += result.items
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + s.amount, 0)
      lastSettlementKey = result.lastKey
    } while (lastSettlementKey)

    return {
      totalPaid,
      totalOwed,
      netBalance: totalPaid - totalOwed + settledAmount,
      expensesPaidCount,
      expensesOwedCount,
      settlementsCount,
      groupCount,
    }
  }

  async getUserGroupBalances(telegramId: number): Promise<UserGroupBalance[]> {
    const memberships = await membersRepository.findGroupsByUser(telegramId)
    const balances: UserGroupBalance[] = []

    for (const membership of memberships.items) {
      const groupId = membership.GSI1SK?.replace('GROUP#', '')
      if (!groupId) continue

      const group = await groupsRepository.findById(groupId)
      if (!group) continue

      // Calculate balance for this group
      const [expenses, settlements] = await Promise.all([
        expensesRepository.findAllByGroup(groupId),
        settlementsRepository.findAllByGroup(groupId),
      ])

      let balance = 0
      const userId = String(telegramId)

      for (const expense of expenses) {
        if (expense.payerId === userId) {
          const payerSplit = expense.splits.find((s) => s.userId === userId)?.amount || 0
          balance += expense.amount - payerSplit
        } else {
          const split = expense.splits.find((s) => s.userId === userId)
          if (split) {
            balance -= split.amount
          }
        }
      }

      for (const settlement of settlements) {
        if (settlement.status === 'completed') {
          if (settlement.fromUserId === userId) {
            balance += settlement.amount
          } else if (settlement.toUserId === userId) {
            balance -= settlement.amount
          }
        }
      }

      balances.push({
        groupId,
        groupTitle: group.title,
        balance: Math.round(balance * 100) / 100,
        currency: group.currency,
      })
    }

    return balances
  }

  async getUserExpenses(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseRecord>> {
    return expensesRepository.findPaidByUser(telegramId, options)
  }
}

export const usersService = new UsersService()
