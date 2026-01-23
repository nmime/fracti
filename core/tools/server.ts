import type { ZodType } from 'zod'

/**
 * Extract JSON from text with optional Zod validation.
 * Server-side version with Zod support.
 */
export function extractJSONWithSchema<T>(text: string, schema: ZodType<T>): T | null {
  const startIndex = text.indexOf('{')
  if (startIndex === -1) return null

  let depth = 0
  let endIndex = -1

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) {
        endIndex = i
        break
      }
    }
  }

  if (endIndex === -1) return null

  const jsonStr = text.slice(startIndex, endIndex + 1)

  try {
    const parsed = JSON.parse(jsonStr)
    return schema.parse(parsed)
  } catch {
    return null
  }
}

/**
 * Extract JSON with error throwing
 */
export function extractJSONOrThrow<T>(text: string, schema?: ZodType<T>): T {
  const startIndex = text.indexOf('{')
  if (startIndex === -1) {
    throw new Error('No JSON object found in text')
  }

  let depth = 0
  let endIndex = -1

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i]
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) {
        endIndex = i
        break
      }
    }
  }

  if (endIndex === -1) {
    throw new Error('Failed to find matching closing brace')
  }

  const jsonStr = text.slice(startIndex, endIndex + 1)

  const parsed = JSON.parse(jsonStr)
  return schema ? schema.parse(parsed) : parsed
}

/**
 * Decode cursor using Buffer (server-side)
 */
export function decodeCursorServer(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
  } catch {
    return undefined
  }
}

/**
 * Encode cursor using Buffer (server-side)
 */
export function encodeCursorServer(lastKey: Record<string, unknown> | undefined): string | undefined {
  if (!lastKey) return undefined
  return Buffer.from(JSON.stringify(lastKey)).toString('base64url')
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error | undefined
  let delay = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw lastError
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * backoffMultiplier, maxDelayMs)
    }
  }

  throw lastError
}

/**
 * Create a timeout promise
 */
export function timeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ])
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
