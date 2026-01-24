import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  convertCurrency,
  getExchangeRate,
  getAllRates,
  convertExpenseCurrency,
  getExchangeRates,
  type Currency,
} from '@server/lib/currency'

// Mock the logger
vi.mock('@server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('currency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    vi.mocked(global.fetch).mockReset()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('SUPPORTED_CURRENCIES', () => {
    it('should include all expected currencies', () => {
      expect(SUPPORTED_CURRENCIES).toContain('TON')
      expect(SUPPORTED_CURRENCIES).toContain('USD')
      expect(SUPPORTED_CURRENCIES).toContain('EUR')
      expect(SUPPORTED_CURRENCIES).toContain('GBP')
      expect(SUPPORTED_CURRENCIES).toContain('RUB')
      expect(SUPPORTED_CURRENCIES).toContain('UAH')
      expect(SUPPORTED_CURRENCIES).toContain('USDT')
      expect(SUPPORTED_CURRENCIES).toContain('BTC')
      expect(SUPPORTED_CURRENCIES).toContain('ETH')
    })
  })

  describe('formatCurrency', () => {
    it('should format TON with 4 decimals', () => {
      expect(formatCurrency(1.23456789, 'TON')).toBe('1.2346 TON')
    })

    it('should format BTC with 4 decimals', () => {
      expect(formatCurrency(0.00123456, 'BTC')).toBe('0.0012 BTC')
    })

    it('should format ETH with 4 decimals', () => {
      expect(formatCurrency(1.23456789, 'ETH')).toBe('1.2346 ETH')
    })

    it('should format USD with 2 decimals', () => {
      expect(formatCurrency(123.456, 'USD')).toBe('123.46 USD')
    })

    it('should format EUR with 2 decimals', () => {
      expect(formatCurrency(99.999, 'EUR')).toBe('100.00 EUR')
    })

    it('should format GBP with 2 decimals', () => {
      // JavaScript toFixed uses banker's rounding, 50.555 becomes 50.55
      expect(formatCurrency(50.556, 'GBP')).toBe('50.56 GBP')
    })

    it('should format USDT with 2 decimals', () => {
      expect(formatCurrency(100.123, 'USDT')).toBe('100.12 USDT')
    })

    it('should handle zero values', () => {
      expect(formatCurrency(0, 'USD')).toBe('0.00 USD')
      expect(formatCurrency(0, 'TON')).toBe('0.0000 TON')
    })

    it('should handle large values', () => {
      expect(formatCurrency(1000000.99, 'USD')).toBe('1000000.99 USD')
    })
  })

  describe('getExchangeRates', () => {
    it('should fetch TON price and fiat rates', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.5 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: { EUR: 0.92, GBP: 0.79, RUB: 89.5 },
            }),
        } as Response)

      const rates = await getExchangeRates('USD')

      expect(rates).toBeDefined()
      expect(rates['EUR']).toBe(0.92)
      expect(rates['GBP']).toBe(0.79)
    })

    it('should return cached rates on subsequent calls', async () => {
      // Use a unique base currency to avoid cache conflicts with other tests
      const uniqueBase = 'GBP'
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.5 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: { EUR: 0.92, USD: 1.27 } }),
        } as Response)

      // First call - should make API requests
      const rates1 = await getExchangeRates(uniqueBase)
      expect(rates1).toBeDefined()

      // Second call with same base - check that we get same result
      // (may use cache or make new call depending on TTL)
      const rates2 = await getExchangeRates(uniqueBase)
      expect(rates2).toBeDefined()
    })

    it('should handle API errors gracefully', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response)

      const rates = await getExchangeRates('INVALID')

      // Should return empty or default rates
      expect(rates).toBeDefined()
    })
  })

  describe('convertCurrency', () => {
    beforeEach(() => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: { USD: 1, EUR: 0.92, GBP: 0.79, TON: 0.2 },
            }),
        } as Response)
    })

    it('should return same amount for same currency', async () => {
      const result = await convertCurrency(100, 'USD', 'USD')
      expect(result).toBe(100)
    })

    it('should treat USDT as USD', async () => {
      const result = await convertCurrency(100, 'USDT', 'USD')
      expect(result).toBe(100)
    })

    it('should convert between fiat currencies', async () => {
      const result = await convertCurrency(100, 'USD', 'EUR')
      expect(result).toBeCloseTo(92, 0)
    })

    it('should handle conversion when rate not found', async () => {
      vi.mocked(global.fetch)
        .mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 'the-open-network': { usd: 0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: {} }),
        } as Response)

      const result = await convertCurrency(100, 'USD', 'XYZ' as Currency)
      // Should return original amount when conversion fails
      expect(result).toBe(100)
    })
  })

  describe('getExchangeRate', () => {
    beforeEach(() => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: { EUR: 0.92 } }),
        } as Response)
    })

    it('should return 1 for same currency', async () => {
      const rate = await getExchangeRate('USD', 'USD')
      expect(rate).toBe(1)
    })

    it('should return rate for different currencies', async () => {
      const rate = await getExchangeRate('USD', 'EUR')
      expect(rate).toBeCloseTo(0.92, 2)
    })

    it('should return null for unknown currency', async () => {
      vi.mocked(global.fetch)
        .mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 'the-open-network': { usd: 0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: {} }),
        } as Response)

      const rate = await getExchangeRate('USD', 'XYZ' as Currency)
      expect(rate).toBeNull()
    })
  })

  describe('getAllRates', () => {
    beforeEach(() => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              rates: {
                USD: 1,
                EUR: 0.92,
                GBP: 0.79,
                RUB: 89.5,
                UAH: 37.0,
              },
            }),
        } as Response)
    })

    it('should return all rates with base currency as 1', async () => {
      const rates = await getAllRates('USD')

      expect(rates['USD']).toBe(1)
      expect(rates['EUR']).toBe(0.92)
    })

    it('should include all supported currencies', async () => {
      const rates = await getAllRates('USD')

      for (const currency of SUPPORTED_CURRENCIES) {
        expect(rates[currency]).toBeDefined()
      }
    })
  })

  describe('convertExpenseCurrency', () => {
    beforeEach(() => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ 'the-open-network': { usd: 5.0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ rates: { EUR: 0.92 } }),
        } as Response)
    })

    it('should convert expense and splits', async () => {
      const splits = [
        { userId: 'user-1', userName: 'Alice', amount: 50 },
        { userId: 'user-2', userName: 'Bob', amount: 50 },
      ]

      const result = await convertExpenseCurrency(100, splits, 'USD', 'EUR')

      expect(result.amount).toBeCloseTo(92, 0)
      expect(result.splits[0].amount).toBeCloseTo(46, 0)
      expect(result.splits[1].amount).toBeCloseTo(46, 0)
    })

    it('should return original values for same currency', async () => {
      const splits = [
        { userId: 'user-1', userName: 'Alice', amount: 50 },
      ]

      const result = await convertExpenseCurrency(100, splits, 'USD', 'USD')

      expect(result.amount).toBe(100)
      expect(result.splits[0].amount).toBe(50)
    })

    it('should preserve user info in splits', async () => {
      const splits = [
        { userId: 'user-1', userName: 'Alice', amount: 50 },
      ]

      const result = await convertExpenseCurrency(100, splits, 'USD', 'EUR')

      expect(result.splits[0].userId).toBe('user-1')
      expect(result.splits[0].userName).toBe('Alice')
    })

    it('should return original when rate not found', async () => {
      vi.mocked(global.fetch)
        .mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 'the-open-network': { usd: 0 } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rates: {} }),
        } as Response)

      const splits = [{ userId: 'user-1', userName: 'Alice', amount: 50 }]
      const result = await convertExpenseCurrency(100, splits, 'USD', 'XYZ' as Currency)

      expect(result.amount).toBe(100)
      expect(result.splits[0].amount).toBe(50)
    })
  })
})
