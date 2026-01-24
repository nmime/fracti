import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateGroupAnalytics,
  generateExpenseReport,
  type GroupAnalytics,
} from '@server/lib/analytics'
import {
  getAllExpenses,
  getAllSettlements,
  getGroupMembers,
} from '@server/lib/dynamodb'

// Mock dynamodb
vi.mock('@server/lib/dynamodb', () => ({
  getAllExpenses: vi.fn(),
  getAllSettlements: vi.fn(),
  getGroupMembers: vi.fn(),
}))

describe('analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateGroupAnalytics', () => {
    const mockMembers = [
      {
        id: 'user-1',
        telegramId: 1001,
        name: 'Alice',
        PK: 'GROUP#test',
        SK: 'USER#1001',
      },
      {
        id: 'user-2',
        telegramId: 1002,
        name: 'Bob',
        PK: 'GROUP#test',
        SK: 'USER#1002',
      },
    ]

    it('should return empty analytics for group with no activity', async () => {
      vi.mocked(getAllExpenses).mockResolvedValue([])
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      expect(analytics.totalExpenses).toBe(0)
      expect(analytics.totalSettled).toBe(0)
      expect(analytics.expenseCount).toBe(0)
      expect(analytics.settlementCount).toBe(0)
      expect(analytics.memberCount).toBe(2)
      expect(analytics.outstandingDebt).toBe(0)
    })

    it('should calculate total expenses correctly', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Lunch',
          splitType: 'equal' as const,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
        {
          id: 'exp-2',
          groupId: 'test-group',
          payerId: 'user-2',
          payerName: 'Bob',
          amount: 50,
          description: 'Coffee',
          splitType: 'equal' as const,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 25 },
            { userId: 'user-2', userName: 'Bob', amount: 25 },
          ],
          createdAt: '2024-01-16T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-16',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      expect(analytics.totalExpenses).toBe(150)
      expect(analytics.expenseCount).toBe(2)
    })

    it('should calculate settled amount from completed settlements', async () => {
      const mockSettlements = [
        {
          id: 'settle-1',
          groupId: 'test-group',
          fromUserId: 'user-2',
          fromUserName: 'Bob',
          toUserId: 'user-1',
          toUserName: 'Alice',
          amount: 50,
          status: 'completed' as const,
          createdAt: '2024-01-17T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'SETTLE#2024-01-17',
        },
        {
          id: 'settle-2',
          groupId: 'test-group',
          fromUserId: 'user-1',
          fromUserName: 'Alice',
          toUserId: 'user-2',
          toUserName: 'Bob',
          amount: 30,
          status: 'pending' as const,
          createdAt: '2024-01-18T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'SETTLE#2024-01-18',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue([])
      vi.mocked(getAllSettlements).mockResolvedValue(mockSettlements)
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      expect(analytics.totalSettled).toBe(50) // Only completed settlement
      expect(analytics.settlementCount).toBe(2)
    })

    it('should calculate member statistics', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Lunch',
          splitType: 'equal' as const,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      const aliceStats = analytics.memberStats.find((m) => m.userId === 'user-1')
      const bobStats = analytics.memberStats.find((m) => m.userId === 'user-2')

      expect(aliceStats?.totalPaid).toBe(100)
      expect(aliceStats?.totalOwed).toBe(50)
      expect(aliceStats?.expenseCount).toBe(1)

      expect(bobStats?.totalPaid).toBe(0)
      expect(bobStats?.totalOwed).toBe(50)
    })

    it('should calculate expenses by category', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Lunch',
          category: 'food',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-1', userName: 'Alice', amount: 100 }],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
        {
          id: 'exp-2',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 50,
          description: 'Taxi',
          category: 'transport',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-1', userName: 'Alice', amount: 50 }],
          createdAt: '2024-01-16T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-16',
        },
        {
          id: 'exp-3',
          groupId: 'test-group',
          payerId: 'user-2',
          payerName: 'Bob',
          amount: 30,
          description: 'Coffee',
          category: 'food',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-2', userName: 'Bob', amount: 30 }],
          createdAt: '2024-01-17T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-17',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      const foodCategory = analytics.expensesByCategory.find((c) => c.category === 'food')
      const transportCategory = analytics.expensesByCategory.find((c) => c.category === 'transport')

      expect(foodCategory?.total).toBe(130)
      expect(foodCategory?.count).toBe(2)
      expect(transportCategory?.total).toBe(50)
      expect(transportCategory?.count).toBe(1)
    })

    it('should return top expenses sorted by amount', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 50,
          description: 'Small expense',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-1', userName: 'Alice', amount: 50 }],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
        {
          id: 'exp-2',
          groupId: 'test-group',
          payerId: 'user-2',
          payerName: 'Bob',
          amount: 200,
          description: 'Large expense',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-2', userName: 'Bob', amount: 200 }],
          createdAt: '2024-01-16T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-16',
        },
        {
          id: 'exp-3',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Medium expense',
          splitType: 'equal' as const,
          splits: [{ userId: 'user-1', userName: 'Alice', amount: 100 }],
          createdAt: '2024-01-17T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-17',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      expect(analytics.topExpenses[0].amount).toBe(200)
      expect(analytics.topExpenses[0].description).toBe('Large expense')
      expect(analytics.topExpenses[1].amount).toBe(100)
      expect(analytics.topExpenses[2].amount).toBe(50)
    })

    it('should calculate average, min, max expense', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 30,
          description: 'Exp 1',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
        {
          id: 'exp-2',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 60,
          description: 'Exp 2',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-16T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-16',
        },
        {
          id: 'exp-3',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 90,
          description: 'Exp 3',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-17T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-17',
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      expect(analytics.averageExpense).toBe(60) // (30+60+90)/3
      expect(analytics.smallestExpense).toBe(30)
      expect(analytics.largestExpense).toBe(90)
    })

    it('should handle expenses without category', async () => {
      const mockExpenses = [
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'No category expense',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
          // No category field
        },
      ]

      vi.mocked(getAllExpenses).mockResolvedValue(mockExpenses)
      vi.mocked(getAllSettlements).mockResolvedValue([])
      vi.mocked(getGroupMembers).mockResolvedValue(mockMembers)

      const analytics = await calculateGroupAnalytics('test-group')

      const otherCategory = analytics.expensesByCategory.find((c) => c.category === 'other')
      expect(otherCategory?.total).toBe(100)
    })
  })

  describe('generateExpenseReport', () => {
    beforeEach(() => {
      vi.mocked(getAllExpenses).mockResolvedValue([
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          currency: 'USD',
          description: 'Lunch',
          category: 'food',
          splitType: 'equal' as const,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
        {
          id: 'exp-2',
          groupId: 'test-group',
          payerId: 'user-2',
          payerName: 'Bob',
          amount: 60,
          description: 'Dinner',
          category: 'food',
          splitType: 'equal' as const,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 30 },
            { userId: 'user-2', userName: 'Bob', amount: 30 },
          ],
          createdAt: '2024-01-20T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-20',
        },
      ])
    })

    it('should generate report for all expenses', async () => {
      const report = await generateExpenseReport('test-group')

      expect(report).toHaveLength(2)
      expect(report[0].description).toBe('Dinner') // Sorted by date desc
      expect(report[1].description).toBe('Lunch')
    })

    it('should filter by user when specified', async () => {
      const report = await generateExpenseReport('test-group', 'user-1')

      expect(report).toHaveLength(2) // Both expenses include user-1
      expect(report.every((r) => r.splitWith.includes('Alice'))).toBe(true)
    })

    it('should filter by start date', async () => {
      const report = await generateExpenseReport(
        'test-group',
        undefined,
        '2024-01-18T00:00:00Z'
      )

      expect(report).toHaveLength(1)
      expect(report[0].description).toBe('Dinner')
    })

    it('should filter by end date', async () => {
      const report = await generateExpenseReport(
        'test-group',
        undefined,
        undefined,
        '2024-01-18T00:00:00Z'
      )

      expect(report).toHaveLength(1)
      expect(report[0].description).toBe('Lunch')
    })

    it('should filter by date range', async () => {
      const report = await generateExpenseReport(
        'test-group',
        undefined,
        '2024-01-10T00:00:00Z',
        '2024-01-16T00:00:00Z'
      )

      expect(report).toHaveLength(1)
      expect(report[0].description).toBe('Lunch')
    })

    it('should calculate user share correctly', async () => {
      const report = await generateExpenseReport('test-group', 'user-2')

      // Find the expense where user-2 paid
      const bobsExpense = report.find((r) => r.payer === 'Bob')
      // When user is payer and in splits, yourShare is their split amount (30)
      expect(bobsExpense?.yourShare).toBe(30)

      // Find the expense where user-2 participated (Alice paid)
      const alicesExpense = report.find((r) => r.payer === 'Alice')
      expect(alicesExpense?.yourShare).toBe(50) // Split amount
    })

    it('should format date correctly', async () => {
      const report = await generateExpenseReport('test-group')

      expect(report[0].date).toBe('2024-01-20')
      expect(report[1].date).toBe('2024-01-15')
    })

    it('should default currency to TON when not specified', async () => {
      vi.mocked(getAllExpenses).mockResolvedValue([
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Test',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
      ])

      const report = await generateExpenseReport('test-group')

      expect(report[0].currency).toBe('TON')
    })

    it('should default category to other when not specified', async () => {
      vi.mocked(getAllExpenses).mockResolvedValue([
        {
          id: 'exp-1',
          groupId: 'test-group',
          payerId: 'user-1',
          payerName: 'Alice',
          amount: 100,
          description: 'Test',
          splitType: 'equal' as const,
          splits: [],
          createdAt: '2024-01-15T10:00:00Z',
          PK: 'GROUP#test',
          SK: 'TX#2024-01-15',
        },
      ])

      const report = await generateExpenseReport('test-group')

      expect(report[0].category).toBe('other')
    })
  })
})
