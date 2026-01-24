import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test the utility functions
// Since they're in the gui/react/app folder, we'll import them directly

describe('Frontend Utils', () => {
  describe('formatTON', () => {
    // Import dynamically to avoid path issues
    let formatTON: (amount: number) => string

    beforeEach(async () => {
      const mod = await import('../../apps/web/app/lib/utils')
      formatTON = mod.formatTON
    })

    it('should format whole numbers with 2 decimal places', () => {
      expect(formatTON(100)).toBe('100.00')
    })

    it('should format numbers with up to 4 decimal places', () => {
      expect(formatTON(1.2345)).toBe('1.2345')
    })

    it('should round to 4 decimal places', () => {
      expect(formatTON(1.23456789)).toBe('1.2346')
    })

    it('should format zero', () => {
      expect(formatTON(0)).toBe('0.00')
    })

    it('should format small amounts', () => {
      expect(formatTON(0.0001)).toBe('0.0001')
    })

    it('should format large amounts with thousand separator', () => {
      expect(formatTON(1000000)).toBe('1,000,000.00')
    })

    it('should handle negative numbers', () => {
      expect(formatTON(-50.5)).toBe('-50.50')
    })
  })

  describe('shortenAddress', () => {
    let shortenAddress: (address: string, chars?: number) => string

    beforeEach(async () => {
      const mod = await import('../../apps/web/app/lib/utils')
      shortenAddress = mod.shortenAddress
    })

    it('should shorten address with default chars (4)', () => {
      const address = 'EQAbCdEfGhIjKlMnOpQrStUvWxYz1234567890'
      const result = shortenAddress(address)
      expect(result).toBe('EQAbCd...7890')
    })

    it('should shorten address with custom chars', () => {
      const address = 'EQAbCdEfGhIjKlMnOpQrStUvWxYz1234567890'
      const result = shortenAddress(address, 6)
      expect(result).toBe('EQAbCdEf...567890')
    })

    it('should return empty string for empty input', () => {
      expect(shortenAddress('')).toBe('')
    })

    it('should handle short addresses', () => {
      const address = 'EQ1234'
      const result = shortenAddress(address)
      expect(result).toBe('EQ1234...1234')
    })
  })

  describe('generateId', () => {
    let generateId: () => string

    beforeEach(async () => {
      const mod = await import('../../apps/web/app/lib/utils')
      generateId = mod.generateId
    })

    it('should generate a string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
    })

    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('should generate non-empty IDs', () => {
      const id = generateId()
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('cn', () => {
    let cn: (...inputs: unknown[]) => string

    beforeEach(async () => {
      const mod = await import('../../apps/web/app/lib/utils')
      cn = mod.cn
    })

    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar')
    })

    it('should handle objects', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
    })

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-4', 'px-8')).toBe('px-8')
    })

    it('should handle empty inputs', () => {
      expect(cn()).toBe('')
    })

    it('should handle null and undefined', () => {
      expect(cn('foo', null, undefined, 'bar')).toBe('foo bar')
    })
  })

  describe('debounce', () => {
    let debounce: <T extends (...args: unknown[]) => unknown>(
      fn: T,
      delay: number
    ) => (...args: Parameters<T>) => void

    beforeEach(async () => {
      vi.useFakeTimers()
      const mod = await import('../../apps/web/app/lib/utils')
      debounce = mod.debounce
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should delay function execution', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should only call function once for multiple rapid calls', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should use the latest arguments', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('third')
    })

    it('should reset timer on each call', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      vi.advanceTimersByTime(50)
      debouncedFn()
      vi.advanceTimersByTime(50)
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})
