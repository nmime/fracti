import { describe, it, expect } from 'vitest'
import {
  extractJSON,
  extractJSONOrThrow,
  safeParseAmount,
  isValidTonAddress,
  isValidBase64,
  paginate,
} from '../../server/lib/utils'

describe('extractJSON', () => {
  it('extracts simple JSON from text', () => {
    const text = 'Here is some JSON: {"amount": 100}'
    const result = extractJSON<{ amount: number }>(text)
    expect(result).toEqual({ amount: 100 })
  })

  it('extracts nested JSON correctly', () => {
    const text = 'Response: {"data": {"value": 42, "nested": {"deep": true}}}'
    const result = extractJSON<{ data: { value: number; nested: { deep: boolean } } }>(text)
    expect(result).toEqual({ data: { value: 42, nested: { deep: true } } })
  })

  it('returns null for text without JSON', () => {
    const result = extractJSON('no json here')
    expect(result).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    const result = extractJSON('{"invalid": }')
    expect(result).toBeNull()
  })

  it('handles JSON at the start of text', () => {
    const result = extractJSON('{"name": "test"} some more text')
    expect(result).toEqual({ name: 'test' })
  })
})

describe('extractJSONOrThrow', () => {
  it('returns parsed JSON for valid input', () => {
    const result = extractJSONOrThrow('{"success": true}')
    expect(result).toEqual({ success: true })
  })

  it('throws error for invalid input', () => {
    expect(() => extractJSONOrThrow('no json')).toThrow(
      'Failed to extract valid JSON from text'
    )
  })
})

describe('safeParseAmount', () => {
  it('parses valid numbers', () => {
    expect(safeParseAmount(100)).toBe(100)
    expect(safeParseAmount(0)).toBe(0)
    expect(safeParseAmount(99.99)).toBe(99.99)
  })

  it('parses valid string numbers', () => {
    expect(safeParseAmount('100')).toBe(100)
    expect(safeParseAmount('99.99')).toBe(99.99)
  })

  it('returns null for negative numbers', () => {
    expect(safeParseAmount(-1)).toBeNull()
    expect(safeParseAmount('-1')).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(safeParseAmount('abc')).toBeNull()
    expect(safeParseAmount(null)).toBeNull()
    expect(safeParseAmount(undefined)).toBeNull()
    expect(safeParseAmount({})).toBeNull()
  })

  it('returns null for Infinity', () => {
    expect(safeParseAmount(Infinity)).toBeNull()
    expect(safeParseAmount(-Infinity)).toBeNull()
  })

  it('returns null for NaN', () => {
    expect(safeParseAmount(NaN)).toBeNull()
  })
})

describe('isValidTonAddress', () => {
  it('validates correct TON addresses', () => {
    expect(isValidTonAddress('EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA')).toBe(true)
    expect(isValidTonAddress('UQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N')).toBe(true)
  })

  it('rejects invalid TON addresses', () => {
    expect(isValidTonAddress('')).toBe(false)
    expect(isValidTonAddress('invalid')).toBe(false)
    expect(isValidTonAddress('0x1234567890abcdef')).toBe(false)
    // Wrong prefix
    expect(isValidTonAddress('ABBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA')).toBe(false)
    // Too short
    expect(isValidTonAddress('EQBynBO23ywHy_CgarY9')).toBe(false)
  })
})

describe('isValidBase64', () => {
  it('validates correct base64 strings', () => {
    expect(isValidBase64('SGVsbG8=')).toBe(true)
    expect(isValidBase64('dGVzdA==')).toBe(true)
    expect(isValidBase64('YWJjZGVm')).toBe(true)
  })

  it('rejects invalid base64 strings', () => {
    expect(isValidBase64('hello!')).toBe(false)
    expect(isValidBase64('abc')).toBe(false) // Wrong padding
  })

  it('checks max size when specified', () => {
    const smallBase64 = 'SGVsbG8=' // "Hello" = 5 bytes
    expect(isValidBase64(smallBase64, 10)).toBe(true)
    expect(isValidBase64(smallBase64, 3)).toBe(false)
  })
})

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('returns first page correctly', () => {
    const result = paginate(items, 0, 3)
    expect(result.items).toEqual([1, 2, 3])
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(10)
  })

  it('returns middle page correctly', () => {
    const result = paginate(items, 1, 3)
    expect(result.items).toEqual([4, 5, 6])
    expect(result.hasMore).toBe(true)
  })

  it('returns last page correctly', () => {
    const result = paginate(items, 3, 3)
    expect(result.items).toEqual([10])
    expect(result.hasMore).toBe(false)
  })

  it('handles empty array', () => {
    const result = paginate([], 0, 10)
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.total).toBe(0)
  })

  it('handles page beyond data', () => {
    const result = paginate(items, 100, 3)
    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
  })
})
