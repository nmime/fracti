import {
  ThrottlingException,
  ServiceQuotaExceededException,
} from '@aws-sdk/client-bedrock-runtime'

/**
 * Retry utility with exponential backoff
 */

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof ThrottlingException ||
        error instanceof ServiceQuotaExceededException ||
        (error instanceof Error && error.name === 'TimeoutError')

      if (!isRetryable || attempt === MAX_RETRIES) {
        console.error(`[${context}] Failed after ${attempt + 1} attempts:`, error)
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      console.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
