import { expensesRepository } from '../repositories/expenses.repository'
import { settlementsRepository } from '../repositories/settlements.repository'
import { membersRepository } from '../repositories/members.repository'
import type { ExpenseRecord } from '../types/db.types'
import { createMemberMap } from '../utils'

export interface GroupAnalytics {
  totalExpenses: number
  totalSettled: number
  outstandingDebt: number
  expenseCount: number
  settlementCount: number
  memberCount: number
  expensesByMonth: Array<{ month: string; total: number; count: number }>
  expensesByWeek: Array<{ week: string; total: number; count: number }>
  expensesByCategory: Array<{ category: string; total: number; count: number; percentage: number }>
  memberStats: Array<{
    userId: string
    userName: string
    totalPaid: number
    totalOwed: number
    netBalance: number
    expenseCount: number
  }>
  topExpenses: Array<{
    id: string
    description: string
    amount: number
    payerName: string
    createdAt: string
  }>
  averageExpense: number
  largestExpense: number
  smallestExpense: number
  mostActiveDay: string
  mostActiveCategory: string
}

class AnalyticsService {
  async getGroupAnalytics(groupId: string): Promise<GroupAnalytics> {
    const [expenses, settlements, members] = await Promise.all([
      expensesRepository.findAllByGroup(groupId),
      settlementsRepository.findAllByGroup(groupId),
      membersRepository.findByGroup(groupId),
    ])

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const completedSettlements = settlements.filter((s) => s.status === 'completed')
    const totalSettled = completedSettlements.reduce((sum, s) => sum + s.amount, 0)

    // Calculate member balances
    const balances = new Map<string, number>()
    const memberPaid = new Map<string, number>()
    const memberOwed = new Map<string, number>()
    const memberExpenseCount = new Map<string, number>()

    for (const member of members) {
      balances.set(member.id, 0)
      memberPaid.set(member.id, 0)
      memberOwed.set(member.id, 0)
      memberExpenseCount.set(member.id, 0)
    }

    for (const expense of expenses) {
      memberPaid.set(expense.payerId, (memberPaid.get(expense.payerId) ?? 0) + expense.amount)
      memberExpenseCount.set(expense.payerId, (memberExpenseCount.get(expense.payerId) ?? 0) + 1)
      balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + expense.amount)

      for (const split of expense.splits) {
        memberOwed.set(split.userId, (memberOwed.get(split.userId) ?? 0) + split.amount)
        balances.set(split.userId, (balances.get(split.userId) ?? 0) - split.amount)
      }
    }

    for (const settlement of completedSettlements) {
      balances.set(
        settlement.fromUserId,
        (balances.get(settlement.fromUserId) ?? 0) + settlement.amount
      )
      balances.set(
        settlement.toUserId,
        (balances.get(settlement.toUserId) ?? 0) - settlement.amount
      )
    }

    let outstandingDebt = 0
    for (const balance of balances.values()) {
      if (balance < 0) {
        outstandingDebt += Math.abs(balance)
      }
    }

    // Expenses by time
    const expensesByMonth = this.groupByMonth(expenses)
    const expensesByWeek = this.groupByWeek(expenses)

    // Expenses by category
    const byCategory = new Map<string, { total: number; count: number }>()
    for (const expense of expenses) {
      const cat = expense.category ?? 'other'
      const existing = byCategory.get(cat) ?? { total: 0, count: 0 }
      byCategory.set(cat, {
        total: existing.total + expense.amount,
        count: existing.count + 1,
      })
    }
    const expensesByCategory = Array.from(byCategory.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    // Member stats
    const memberMap = createMemberMap(members)
    const memberStats = Array.from(balances.entries())
      .map(([userId, balance]) => ({
        userId,
        userName: memberMap.get(userId)?.name ?? 'Unknown',
        totalPaid: memberPaid.get(userId) ?? 0,
        totalOwed: memberOwed.get(userId) ?? 0,
        netBalance: balance,
        expenseCount: memberExpenseCount.get(userId) ?? 0,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)

    // Top expenses
    const topExpenses = [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        payerName: e.payerName,
        createdAt: e.createdAt,
      }))

    // Statistics
    const amounts = expenses.map((e) => e.amount)
    const averageExpense = amounts.length > 0 ? totalExpenses / amounts.length : 0
    const largestExpense = amounts.length > 0 ? Math.max(...amounts) : 0
    const smallestExpense = amounts.length > 0 ? Math.min(...amounts) : 0

    // Most active day
    const dayCount = new Map<string, number>()
    for (const expense of expenses) {
      const day = new Date(expense.createdAt).toLocaleDateString('en-US', { weekday: 'long' })
      dayCount.set(day, (dayCount.get(day) ?? 0) + 1)
    }
    const mostActiveDay =
      Array.from(dayCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

    const mostActiveCategory = expensesByCategory[0]?.category ?? 'N/A'

    return {
      totalExpenses,
      totalSettled,
      outstandingDebt,
      expenseCount: expenses.length,
      settlementCount: settlements.length,
      memberCount: members.length,
      expensesByMonth,
      expensesByWeek,
      expensesByCategory,
      memberStats,
      topExpenses,
      averageExpense,
      largestExpense,
      smallestExpense,
      mostActiveDay,
      mostActiveCategory,
    }
  }

  private groupByMonth(expenses: ExpenseRecord[]): Array<{ month: string; total: number; count: number }> {
    const groups = new Map<string, { total: number; count: number }>()

    for (const expense of expenses) {
      const date = new Date(expense.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = groups.get(key) ?? { total: 0, count: 0 }
      groups.set(key, {
        total: existing.total + expense.amount,
        count: existing.count + 1,
      })
    }

    return Array.from(groups.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  private groupByWeek(expenses: ExpenseRecord[]): Array<{ week: string; total: number; count: number }> {
    const groups = new Map<string, { total: number; count: number }>()

    for (const expense of expenses) {
      const date = new Date(expense.createdAt)
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000)
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7)
      const key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`

      const existing = groups.get(key) ?? { total: 0, count: 0 }
      groups.set(key, {
        total: existing.total + expense.amount,
        count: existing.count + 1,
      })
    }

    return Array.from(groups.entries())
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)
  }
}

export const analyticsService = new AnalyticsService()

/**
 * Expense report row for CSV/export functionality
 */
export interface ExpenseReportRow {
  date: string
  description: string
  amount: number
  currency: string
  payer: string
  category: string
  splitWith: string
  yourShare: number
}

/**
 * Generate expense report rows for export
 */
export async function generateExpenseReport(
  groupId: string,
  userId?: string,
  startDate?: string,
  endDate?: string
): Promise<ExpenseReportRow[]> {
  const expenses = await expensesRepository.findAllByGroup(groupId)

  const filtered = expenses.filter((e) => {
    if (startDate && e.createdAt < startDate) return false
    if (endDate && e.createdAt > endDate) return false
    return true
  })

  return filtered.map((expense) => {
    const splitNames = expense.splits.map((s) => s.userName).join(', ')
    const userSplit = userId ? expense.splits.find((s) => s.userId === userId) : null
    const userShare = userSplit?.amount ?? (expense.amount / expense.splits.length)

    return {
      date: new Date(expense.createdAt).toISOString().split('T')[0],
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency ?? 'TON',
      payer: expense.payerName,
      category: expense.category ?? 'other',
      splitWith: splitNames,
      yourShare: userShare,
    }
  })
}
