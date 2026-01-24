import { describe, it, expect } from 'vitest'
import {
  calculateBalances,
  buildDebtGraph,
  optimizeSettlements,
  getUserDebts,
  type DebtGraph,
} from '@server/lib/debt-graph'
import type { ExpenseRecord, SettlementRecord, UserRecord } from '@server/lib/dynamodb'

// Test data factories
function createExpense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  const now = new Date().toISOString()
  return {
    PK: 'GROUP#test-group',
    SK: `TX#${now}`,
    id: 'expense-1',
    groupId: 'test-group',
    payerId: 'user-1',
    payerName: 'Alice',
    amount: 100,
    description: 'Test expense',
    splitType: 'equal',
    splits: [
      { userId: 'user-1', userName: 'Alice', amount: 50 },
      { userId: 'user-2', userName: 'Bob', amount: 50 },
    ],
    createdAt: now,
    ...overrides,
  }
}

function createSettlement(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  const now = new Date().toISOString()
  return {
    PK: 'GROUP#test-group',
    SK: `SETTLE#${now}`,
    id: 'settlement-1',
    groupId: 'test-group',
    fromUserId: 'user-2',
    fromUserName: 'Bob',
    toUserId: 'user-1',
    toUserName: 'Alice',
    amount: 50,
    status: 'completed',
    createdAt: now,
    ...overrides,
  }
}

function createMember(id: string, name: string, wallet?: string): UserRecord {
  return {
    PK: 'GROUP#test-group',
    SK: `USER#${id}`,
    id,
    telegramId: parseInt(id.replace('user-', '')) * 1000,
    name,
    wallet,
  }
}

describe('debt-graph', () => {
  describe('calculateBalances', () => {
    it('should calculate zero balances when no expenses', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]

      const balances = calculateBalances([], [], members)

      expect(balances.get('user-1')).toBe(0)
      expect(balances.get('user-2')).toBe(0)
    })

    it('should calculate balances for single expense split equally', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const expenses = [
        createExpense({
          payerId: 'user-1',
          amount: 100,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
        }),
      ]

      const balances = calculateBalances(expenses, [], members)

      // Alice paid 100, owes 50 = net +50
      expect(balances.get('user-1')).toBe(50)
      // Bob paid 0, owes 50 = net -50
      expect(balances.get('user-2')).toBe(-50)
    })

    it('should calculate balances for multiple expenses', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
        createMember('user-3', 'Charlie'),
      ]
      const expenses = [
        createExpense({
          id: 'expense-1',
          payerId: 'user-1',
          amount: 90,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 30 },
            { userId: 'user-2', userName: 'Bob', amount: 30 },
            { userId: 'user-3', userName: 'Charlie', amount: 30 },
          ],
        }),
        createExpense({
          id: 'expense-2',
          payerId: 'user-2',
          amount: 60,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 20 },
            { userId: 'user-2', userName: 'Bob', amount: 20 },
            { userId: 'user-3', userName: 'Charlie', amount: 20 },
          ],
        }),
      ]

      const balances = calculateBalances(expenses, [], members)

      // Alice: paid 90, owes 30+20 = 50, net = 90-30-20 = 40
      expect(balances.get('user-1')).toBe(40)
      // Bob: paid 60, owes 30+20 = 50, net = 60-30-20 = 10
      expect(balances.get('user-2')).toBe(10)
      // Charlie: paid 0, owes 30+20 = 50, net = -50
      expect(balances.get('user-3')).toBe(-50)
    })

    it('should apply completed settlements to balances', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const expenses = [
        createExpense({
          payerId: 'user-1',
          amount: 100,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
        }),
      ]
      const settlements = [
        createSettlement({
          fromUserId: 'user-2',
          toUserId: 'user-1',
          amount: 50,
          status: 'completed',
        }),
      ]

      const balances = calculateBalances(expenses, settlements, members)

      // After settlement, both should be at 0
      expect(balances.get('user-1')).toBe(0)
      expect(balances.get('user-2')).toBe(0)
    })

    it('should ignore pending settlements', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const expenses = [
        createExpense({
          payerId: 'user-1',
          amount: 100,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
        }),
      ]
      const settlements = [
        createSettlement({
          fromUserId: 'user-2',
          toUserId: 'user-1',
          amount: 50,
          status: 'pending',
        }),
      ]

      const balances = calculateBalances(expenses, settlements, members)

      // Pending settlement should not affect balances
      expect(balances.get('user-1')).toBe(50)
      expect(balances.get('user-2')).toBe(-50)
    })

    it('should handle partial settlements', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const expenses = [
        createExpense({
          payerId: 'user-1',
          amount: 100,
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 50 },
            { userId: 'user-2', userName: 'Bob', amount: 50 },
          ],
        }),
      ]
      const settlements = [
        createSettlement({
          fromUserId: 'user-2',
          toUserId: 'user-1',
          amount: 25,
          status: 'completed',
        }),
      ]

      const balances = calculateBalances(expenses, settlements, members)

      // Bob still owes 25
      expect(balances.get('user-1')).toBe(25)
      expect(balances.get('user-2')).toBe(-25)
    })

    it('should handle uneven splits', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const expenses = [
        createExpense({
          payerId: 'user-1',
          amount: 100,
          splitType: 'exact',
          splits: [
            { userId: 'user-1', userName: 'Alice', amount: 30 },
            { userId: 'user-2', userName: 'Bob', amount: 70 },
          ],
        }),
      ]

      const balances = calculateBalances(expenses, [], members)

      // Alice paid 100, owes 30 = net +70
      expect(balances.get('user-1')).toBe(70)
      // Bob paid 0, owes 70 = net -70
      expect(balances.get('user-2')).toBe(-70)
    })
  })

  describe('buildDebtGraph', () => {
    it('should build empty graph for zero balances', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const balances = new Map([
        ['user-1', 0],
        ['user-2', 0],
      ])

      const graph = buildDebtGraph(balances, members)

      expect(graph.nodes).toHaveLength(2)
      expect(graph.edges).toHaveLength(0)
    })

    it('should build graph with single edge for simple debt', () => {
      const members = [
        createMember('user-1', 'Alice', 'wallet-1'),
        createMember('user-2', 'Bob', 'wallet-2'),
      ]
      const balances = new Map([
        ['user-1', 50],
        ['user-2', -50],
      ])

      const graph = buildDebtGraph(balances, members)

      expect(graph.nodes).toHaveLength(2)
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0]).toEqual({
        from: 'user-2',
        to: 'user-1',
        amount: 50,
      })

      // Check nodes have wallet info
      const aliceNode = graph.nodes.find((n) => n.id === 'user-1')
      expect(aliceNode?.wallet).toBe('wallet-1')
    })

    it('should create optimized edges for multiple debts', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
        createMember('user-3', 'Charlie'),
      ]
      const balances = new Map([
        ['user-1', 100],
        ['user-2', -60],
        ['user-3', -40],
      ])

      const graph = buildDebtGraph(balances, members)

      expect(graph.nodes).toHaveLength(3)
      // Should create edges from debtors to creditors
      expect(graph.edges.length).toBeGreaterThan(0)

      // Total debt should equal total credit
      const totalDebt = graph.edges.reduce((sum, e) => sum + e.amount, 0)
      expect(totalDebt).toBe(100)
    })

    it('should ignore small balances below threshold', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const balances = new Map([
        ['user-1', 0.005],
        ['user-2', -0.005],
      ])

      const graph = buildDebtGraph(balances, members)

      expect(graph.edges).toHaveLength(0)
    })

    it('should round amounts to 2 decimal places', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const balances = new Map([
        ['user-1', 33.333333],
        ['user-2', -33.333333],
      ])

      const graph = buildDebtGraph(balances, members)

      expect(graph.nodes[0].balance).toBe(33.33)
      if (graph.edges.length > 0) {
        expect(graph.edges[0].amount).toBe(33.33)
      }
    })
  })

  describe('optimizeSettlements', () => {
    it('should return empty array for zero balances', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const balances = new Map([
        ['user-1', 0],
        ['user-2', 0],
      ])

      const settlements = optimizeSettlements(balances, members)

      expect(settlements).toHaveLength(0)
    })

    it('should create single settlement for simple debt', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
      ]
      const balances = new Map([
        ['user-1', 50],
        ['user-2', -50],
      ])

      const settlements = optimizeSettlements(balances, members)

      expect(settlements).toHaveLength(1)
      expect(settlements[0]).toEqual({
        fromUserId: 'user-2',
        fromUserName: 'Bob',
        toUserId: 'user-1',
        toUserName: 'Alice',
        amount: 50,
      })
    })

    it('should minimize number of settlements for complex debts', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
        createMember('user-3', 'Charlie'),
        createMember('user-4', 'Diana'),
      ]
      // Alice is owed 60, Bob owes 30, Charlie owes 20, Diana owes 10
      const balances = new Map([
        ['user-1', 60],
        ['user-2', -30],
        ['user-3', -20],
        ['user-4', -10],
      ])

      const settlements = optimizeSettlements(balances, members)

      // Should create settlements that sum to 60
      const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0)
      expect(totalAmount).toBe(60)

      // All settlements should be to Alice
      settlements.forEach((s) => {
        expect(s.toUserId).toBe('user-1')
      })
    })

    it('should handle multiple creditors', () => {
      const members = [
        createMember('user-1', 'Alice'),
        createMember('user-2', 'Bob'),
        createMember('user-3', 'Charlie'),
      ]
      // Alice is owed 50, Bob is owed 30, Charlie owes 80
      const balances = new Map([
        ['user-1', 50],
        ['user-2', 30],
        ['user-3', -80],
      ])

      const settlements = optimizeSettlements(balances, members)

      // Total should balance
      const totalAmount = settlements.reduce((sum, s) => sum + s.amount, 0)
      expect(totalAmount).toBe(80)

      // Charlie should pay everyone
      settlements.forEach((s) => {
        expect(s.fromUserId).toBe('user-3')
      })
    })

    it('should skip unknown members', () => {
      const members = [createMember('user-1', 'Alice')]
      const balances = new Map([
        ['user-1', 50],
        ['unknown-user', -50],
      ])

      const settlements = optimizeSettlements(balances, members)

      // Should not create settlement with unknown user
      expect(settlements).toHaveLength(0)
    })
  })

  describe('getUserDebts', () => {
    it('should return user debts from graph', () => {
      const graph: DebtGraph = {
        nodes: [
          { id: 'user-1', name: 'Alice', balance: 50 },
          { id: 'user-2', name: 'Bob', balance: -30 },
          { id: 'user-3', name: 'Charlie', balance: -20 },
        ],
        edges: [
          { from: 'user-2', to: 'user-1', amount: 30 },
          { from: 'user-3', to: 'user-1', amount: 20 },
        ],
      }

      const debts = getUserDebts('user-1', graph)

      expect(debts.netBalance).toBe(50)
      expect(debts.owes).toHaveLength(0)
      expect(debts.owed).toHaveLength(2)
      expect(debts.owed).toContainEqual({
        from: 'user-2',
        fromName: 'Bob',
        amount: 30,
      })
      expect(debts.owed).toContainEqual({
        from: 'user-3',
        fromName: 'Charlie',
        amount: 20,
      })
    })

    it('should return user owes from graph', () => {
      const graph: DebtGraph = {
        nodes: [
          { id: 'user-1', name: 'Alice', balance: 100 },
          { id: 'user-2', name: 'Bob', balance: -100 },
        ],
        edges: [{ from: 'user-2', to: 'user-1', amount: 100 }],
      }

      const debts = getUserDebts('user-2', graph)

      expect(debts.netBalance).toBe(-100)
      expect(debts.owed).toHaveLength(0)
      expect(debts.owes).toHaveLength(1)
      expect(debts.owes[0]).toEqual({
        to: 'user-1',
        toName: 'Alice',
        amount: 100,
      })
    })

    it('should return zero balance for unknown user', () => {
      const graph: DebtGraph = {
        nodes: [{ id: 'user-1', name: 'Alice', balance: 50 }],
        edges: [],
      }

      const debts = getUserDebts('unknown', graph)

      expect(debts.netBalance).toBe(0)
      expect(debts.owes).toHaveLength(0)
      expect(debts.owed).toHaveLength(0)
    })
  })
})
