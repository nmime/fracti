import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateExpenseCSV } from '@server/lib/export'
import type { ExpenseReportRow } from '@server/lib/analytics'

// Mock dynamodb
vi.mock('@server/lib/dynamodb', () => ({
  getAllSettlements: vi.fn(),
  getGroup: vi.fn(),
  getGroupMembers: vi.fn(),
}))

// Mock analytics
vi.mock('@server/lib/analytics', () => ({
  generateExpenseReport: vi.fn(),
}))

describe('export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateExpenseCSV', () => {
    it('should generate CSV with headers', () => {
      const expenses: ExpenseReportRow[] = []
      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('Date,Description,Amount,Currency,Paid By,Category,Split With,Your Share')
    })

    it('should include expense data in rows', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch',
          amount: 50.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'food',
          splitWith: 'Alice, Bob',
          yourShare: 25.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)
      const lines = csv.split('\n')

      expect(lines).toHaveLength(2) // Header + 1 row
      expect(lines[1]).toContain('2024-01-15')
      expect(lines[1]).toContain('50.00')
      expect(lines[1]).toContain('USD')
      expect(lines[1]).toContain('food')
      expect(lines[1]).toContain('25.00')
    })

    it('should escape quotes in description', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch at "Joe\'s Diner"',
          amount: 50.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'food',
          splitWith: 'Alice, Bob',
          yourShare: 25.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('""Joe\'s Diner""')
    })

    it('should escape quotes in payer name', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch',
          amount: 50.00,
          currency: 'USD',
          payer: 'Alice "The Boss" Smith',
          category: 'food',
          splitWith: 'Alice, Bob',
          yourShare: 25.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('""The Boss""')
    })

    it('should escape quotes in splitWith', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch',
          amount: 50.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'food',
          splitWith: 'Alice "A", Bob "B"',
          yourShare: 25.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('""A""')
      expect(csv).toContain('""B""')
    })

    it('should format amounts with 2 decimal places', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch',
          amount: 50.999,
          currency: 'USD',
          payer: 'Alice',
          category: 'food',
          splitWith: 'Alice',
          yourShare: 25.5,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('51.00')
      expect(csv).toContain('25.50')
    })

    it('should handle empty expenses array', () => {
      const expenses: ExpenseReportRow[] = []
      const csv = generateExpenseCSV(expenses)

      const lines = csv.split('\n')
      expect(lines).toHaveLength(1) // Just header
    })

    it('should handle multiple expenses', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Lunch',
          amount: 50.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'food',
          splitWith: 'Alice, Bob',
          yourShare: 25.00,
        },
        {
          date: '2024-01-16',
          description: 'Dinner',
          amount: 100.00,
          currency: 'EUR',
          payer: 'Bob',
          category: 'food',
          splitWith: 'Alice, Bob, Charlie',
          yourShare: 33.33,
        },
        {
          date: '2024-01-17',
          description: 'Uber',
          amount: 20.00,
          currency: 'USD',
          payer: 'Charlie',
          category: 'transport',
          splitWith: 'Alice, Charlie',
          yourShare: 10.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)
      const lines = csv.split('\n')

      expect(lines).toHaveLength(4) // Header + 3 rows
      expect(csv).toContain('Lunch')
      expect(csv).toContain('Dinner')
      expect(csv).toContain('Uber')
    })

    it('should handle special characters in category', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Test',
          amount: 10.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'food & drinks',
          splitWith: 'Alice',
          yourShare: 10.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('food & drinks')
    })

    it('should handle TON currency', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Test',
          amount: 10.5,
          currency: 'TON',
          payer: 'Alice',
          category: 'other',
          splitWith: 'Alice, Bob',
          yourShare: 5.25,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('10.50')
      expect(csv).toContain('TON')
      expect(csv).toContain('5.25')
    })

    it('should generate valid CSV format', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Test',
          amount: 100.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'other',
          splitWith: 'Alice, Bob',
          yourShare: 50.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)
      const lines = csv.split('\n')

      // Each line should have 8 columns
      lines.forEach((line) => {
        // Count commas outside of quoted strings
        const columns = line.split(',')
        expect(columns.length).toBeGreaterThanOrEqual(8)
      })
    })

    it('should handle zero amounts', () => {
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: 'Free item',
          amount: 0,
          currency: 'USD',
          payer: 'Alice',
          category: 'other',
          splitWith: 'Alice',
          yourShare: 0,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain('0.00')
    })

    it('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(1000)
      const expenses: ExpenseReportRow[] = [
        {
          date: '2024-01-15',
          description: longDescription,
          amount: 10.00,
          currency: 'USD',
          payer: 'Alice',
          category: 'other',
          splitWith: 'Alice',
          yourShare: 10.00,
        },
      ]

      const csv = generateExpenseCSV(expenses)

      expect(csv).toContain(longDescription)
    })
  })
})
