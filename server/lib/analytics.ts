import {
  getAllExpenses,
  getAllSettlements,
  getGroupMembers,
  type ExpenseRecord,
  type SettlementRecord,
  type MemberRecord,
} from './dynamodb'

/**
 * Analytics and statistics for groups and users
 */

export interface GroupAnalytics {
  // Overview
  totalExpenses: number
  totalSettled: number
  outstandingDebt: number
  expenseCount: number
  settlementCount: number
  memberCount: number

  // Time-based
  expensesByMonth: Array<{ month: string; total: number; count: number }>
  expensesByWeek: Array<{ week: string; total: number; count: number }>

  // Category breakdown
  expensesByCategory: Array<{ category: string; total: number; count: number; percentage: number }>

  // Member stats
  memberStats: Array<{
    userId: string
    userName: string
    totalPaid: number
    totalOwed: number
    netBalance: number
    expenseCount: number
  }>

  // Top expenses
  topExpenses: Array<{
    id: string
    description: string
    amount: number
    payerName: string
    createdAt: string
  }>

  // Trends
  averageExpense: number
  largestExpense: number
  smallestExpense: number
  mostActiveDay: string
  mostActiveCategory: string
}

export interface UserAnalytics {
  totalPaid: number
  totalOwed: number
  totalSettled: number
  netBalance: number
  expensesPaidCount: number
  expensesParticipatedCount: number
  settlementsCount: number
  groupsCount: number

  // By group
  groupBreakdown: Array<{
    groupId: string
    groupTitle: string
    totalPaid: number
    totalOwed: number
    netBalance: number
  }>

  // By category
  categoryBreakdown: Array<{
    category: string
    totalPaid: number
    count: number
    percentage: number
  }>

  // Time series
  monthlySpending: Array<{ month: string; paid: number; owed: number }>
}

/**
 * Calculate group analytics
 */
export async function calculateGroupAnalytics(
  groupId: string
): Promise<GroupAnalytics> {
  const [expenses, settlements, members] = await Promise.all([
    getAllExpenses(groupId),
    getAllSettlements(groupId),
    getGroupMembers(groupId),
  ])

  // Basic totals
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
    // Track payer
    memberPaid.set(expense.payerId, (memberPaid.get(expense.payerId) ?? 0) + expense.amount)
    memberExpenseCount.set(expense.payerId, (memberExpenseCount.get(expense.payerId) ?? 0) + 1)

    // Track balance
    balances.set(
      expense.payerId,
      (balances.get(expense.payerId) ?? 0) + expense.amount
    )

    // Track splits
    for (const split of expense.splits) {
      memberOwed.set(split.userId, (memberOwed.get(split.userId) ?? 0) + split.amount)
      balances.set(
        split.userId,
        (balances.get(split.userId) ?? 0) - split.amount
      )
    }
  }

  // Apply settlements
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

  // Calculate outstanding debt (sum of negative balances)
  let outstandingDebt = 0
  for (const balance of balances.values()) {
    if (balance < 0) {
      outstandingDebt += Math.abs(balance)
    }
  }

  // Expenses by month
  const byMonth = groupByTimePeriod(expenses, 'month')
  const expensesByMonth = Object.entries(byMonth).map(([month, items]) => ({
    month,
    total: items.reduce((sum, e) => sum + e.amount, 0),
    count: items.length,
  })).sort((a, b) => a.month.localeCompare(b.month))

  // Expenses by week
  const byWeek = groupByTimePeriod(expenses, 'week')
  const expensesByWeek = Object.entries(byWeek).map(([week, items]) => ({
    week,
    total: items.reduce((sum, e) => sum + e.amount, 0),
    count: items.length,
  })).sort((a, b) => a.week.localeCompare(b.week)).slice(-12) // Last 12 weeks

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
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const memberStats = Array.from(balances.entries()).map(([userId, balance]) => ({
    userId,
    userName: memberMap.get(userId)?.name ?? 'Unknown',
    totalPaid: memberPaid.get(userId) ?? 0,
    totalOwed: memberOwed.get(userId) ?? 0,
    netBalance: balance,
    expenseCount: memberExpenseCount.get(userId) ?? 0,
  })).sort((a, b) => b.totalPaid - a.totalPaid)

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
  const mostActiveDay = Array.from(dayCount.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

  // Most active category
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

/**
 * Group expenses by time period
 */
function groupByTimePeriod(
  expenses: ExpenseRecord[],
  period: 'month' | 'week'
): Record<string, ExpenseRecord[]> {
  const groups: Record<string, ExpenseRecord[]> = {}

  for (const expense of expenses) {
    const date = new Date(expense.createdAt)
    let key: string

    if (period === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    } else {
      // ISO week
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000)
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7)
      key = `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
    }

    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(expense)
  }

  return groups
}

/**
 * Generate expense report data for export
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

export async function generateExpenseReport(
  groupId: string,
  userId?: string,
  startDate?: string,
  endDate?: string
): Promise<ExpenseReportRow[]> {
  const expenses = await getAllExpenses(groupId)

  let filtered = expenses

  // Filter by date range
  if (startDate) {
    filtered = filtered.filter((e) => e.createdAt >= startDate)
  }
  if (endDate) {
    filtered = filtered.filter((e) => e.createdAt <= endDate)
  }

  // Filter by user if specified
  if (userId) {
    filtered = filtered.filter(
      (e) => e.payerId === userId || e.splits.some((s) => s.userId === userId)
    )
  }

  return filtered.map((expense) => {
    const userSplit = userId ? expense.splits.find((s) => s.userId === userId) : null

    return {
      date: new Date(expense.createdAt).toISOString().split('T')[0],
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency ?? 'TON',
      payer: expense.payerName,
      category: expense.category ?? 'other',
      splitWith: expense.splits.map((s) => s.userName).join(', '),
      yourShare: userSplit?.amount ?? (expense.payerId === userId ? expense.amount : 0),
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
}
