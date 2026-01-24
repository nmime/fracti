import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateNextRun, recurringKeys } from '@server/lib/recurring'

// Mock DynamoDB
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  PutCommand: vi.fn(),
  QueryCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  GetCommand: vi.fn(),
}))

// Mock the dynamodb module
vi.mock('@server/lib/dynamodb', () => ({
  docClient: {
    send: vi.fn(),
  },
  createExpense: vi.fn(),
  getGroup: vi.fn(),
}))

// Mock config
vi.mock('@server/lib/config', () => ({
  config: {
    TABLE_NAME: 'test-table',
  },
}))

// Mock logger
vi.mock('@server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock notifications
vi.mock('@server/lib/notifications', () => ({
  notifyNewExpense: vi.fn(),
}))

describe('recurring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recurringKeys', () => {
    it('should generate correct template key', () => {
      const key = recurringKeys.template('group-123', 'template-456')

      expect(key).toEqual({
        PK: 'GROUP#group-123',
        SK: 'RECURRING#template-456',
      })
    })
  })

  describe('calculateNextRun', () => {
    describe('daily frequency', () => {
      it('should add 1 day for daily frequency', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('daily', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getDate()).toBe(16)
        expect(nextDate.getMonth()).toBe(0) // January
      })

      it('should handle month boundary', () => {
        const baseDate = new Date('2024-01-31T10:00:00Z')
        const nextRun = calculateNextRun('daily', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getDate()).toBe(1)
        expect(nextDate.getMonth()).toBe(1) // February
      })

      it('should handle year boundary', () => {
        const baseDate = new Date('2024-12-31T10:00:00Z')
        const nextRun = calculateNextRun('daily', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getDate()).toBe(1)
        expect(nextDate.getMonth()).toBe(0) // January
        expect(nextDate.getFullYear()).toBe(2025)
      })
    })

    describe('weekly frequency', () => {
      it('should add 7 days for weekly frequency', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z') // Monday
        const nextRun = calculateNextRun('weekly', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getDate()).toBe(22)
      })

      it('should adjust to specific day of week when provided', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z') // Monday
        // Schedule for Friday (5)
        const nextRun = calculateNextRun('weekly', baseDate, { dayOfWeek: 5 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getDay()).toBe(5) // Friday
      })

      it('should handle dayOfWeek with wrap around', () => {
        const baseDate = new Date('2024-01-19T10:00:00Z') // Friday
        // Schedule for Monday (1)
        const nextRun = calculateNextRun('weekly', baseDate, { dayOfWeek: 1 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getDay()).toBe(1) // Monday
        expect(nextDate.getDate()).toBeGreaterThan(19)
      })
    })

    describe('monthly frequency', () => {
      it('should add 1 month for monthly frequency', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('monthly', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getMonth()).toBe(1) // February
        expect(nextDate.getDate()).toBe(15)
      })

      it('should respect dayOfMonth option', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('monthly', baseDate, { dayOfMonth: 1 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getMonth()).toBe(1) // February
        expect(nextDate.getDate()).toBe(1)
      })

      it('should handle months with fewer days', () => {
        // Start from Jan 15 and ask for day 31 of next month
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('monthly', baseDate, { dayOfMonth: 31 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getMonth()).toBe(1) // February
        // February 2024 has 29 days (leap year), so day 31 is capped to 29
        expect(nextDate.getDate()).toBe(29)
      })

      it('should handle February in non-leap year', () => {
        // Start from Jan 15 and ask for day 31 of next month
        const baseDate = new Date('2023-01-15T10:00:00Z')
        const nextRun = calculateNextRun('monthly', baseDate, { dayOfMonth: 31 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getMonth()).toBe(1) // February
        // February 2023 has 28 days
        expect(nextDate.getDate()).toBe(28)
      })

      it('should handle year boundary', () => {
        const baseDate = new Date('2024-12-15T10:00:00Z')
        const nextRun = calculateNextRun('monthly', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getMonth()).toBe(0) // January
        expect(nextDate.getFullYear()).toBe(2025)
      })
    })

    describe('yearly frequency', () => {
      it('should add 1 year for yearly frequency', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('yearly', baseDate)

        const nextDate = new Date(nextRun)
        expect(nextDate.getFullYear()).toBe(2025)
        expect(nextDate.getMonth()).toBe(0)
        expect(nextDate.getDate()).toBe(15)
      })

      it('should respect monthOfYear option', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('yearly', baseDate, { monthOfYear: 6 })

        const nextDate = new Date(nextRun)
        expect(nextDate.getFullYear()).toBe(2025)
        expect(nextDate.getMonth()).toBe(5) // June (0-indexed)
      })

      it('should respect both monthOfYear and dayOfMonth', () => {
        const baseDate = new Date('2024-01-15T10:00:00Z')
        const nextRun = calculateNextRun('yearly', baseDate, {
          monthOfYear: 3,
          dayOfMonth: 25,
        })

        const nextDate = new Date(nextRun)
        expect(nextDate.getFullYear()).toBe(2025)
        expect(nextDate.getMonth()).toBe(2) // March
        expect(nextDate.getDate()).toBe(25)
      })

      it('should handle February 29 in non-leap year', () => {
        const baseDate = new Date('2024-02-29T10:00:00Z') // Leap year
        const nextRun = calculateNextRun('yearly', baseDate, {
          monthOfYear: 2,
          dayOfMonth: 29,
        })

        const nextDate = new Date(nextRun)
        expect(nextDate.getFullYear()).toBe(2025)
        expect(nextDate.getMonth()).toBe(1) // February
        expect(nextDate.getDate()).toBe(28) // Capped to 28 in non-leap year
      })
    })

    describe('default behavior', () => {
      it('should use current date when no fromDate provided', () => {
        const beforeCall = new Date()
        const nextRun = calculateNextRun('daily')
        const afterCall = new Date()

        const nextDate = new Date(nextRun)
        // Next run should be approximately 1 day from now
        const expectedMin = new Date(beforeCall.getTime() + 24 * 60 * 60 * 1000)
        const expectedMax = new Date(afterCall.getTime() + 24 * 60 * 60 * 1000)

        expect(nextDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000)
        expect(nextDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000)
      })

      it('should return ISO string format', () => {
        const nextRun = calculateNextRun('daily', new Date('2024-01-15T10:30:00Z'))

        expect(nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      })
    })
  })
})
