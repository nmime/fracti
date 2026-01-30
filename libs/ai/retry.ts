import { ThrottlingException, ServiceQuotaExceededException } from '@aws-sdk/client-bedrock-runtime';
import type { LoggerInterface } from './types';

/**
 * Retry utility with exponential backoff
 */

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

// Default console-based logger
/* eslint-disable no-console */
const defaultLogger: LoggerInterface = {
  debug: (message, context) => {
    console.debug(message, context);
  },
  info: (message, context) => {
    console.info(message, context);
  },
  warn: (message, context) => {
    console.warn(message, context);
  },
  error: (message, context, error) => {
    console.error(message, context, error);
  },
};
/* eslint-enable no-console */

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  logger: LoggerInterface = defaultLogger,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const isRetryable =
        error instanceof ThrottlingException ||
        error instanceof ServiceQuotaExceededException ||
        (error instanceof Error && error.name === 'TimeoutError');

      if (!isRetryable || attempt === MAX_RETRIES) {
        logger.error(`${context} failed after ${attempt + 1} attempts`, { attempt, errorName: lastError.name }, error);
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      logger.warn(`${context} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`, {
        attempt,
        errorName: lastError.name,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw lastError;
}
