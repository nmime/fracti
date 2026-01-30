import type { Context, Next, MiddlewareHandler } from 'hono';

interface BodyLimitConfig {
  /** Maximum body size in bytes */
  maxSize: number;
  /** Custom error message */
  message?: string;
  /** Skip body limit for certain conditions */
  skip?: (c: Context) => boolean;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Create body size limiting middleware
 *
 * Validates request body size to prevent DoS attacks via large payloads.
 * Checks both Content-Length header (if present) and actual body size.
 *
 * @example
 * ```ts
 * // Global 1MB limit
 * app.use(bodyLimit({ maxSize: 1024 * 1024 }))
 *
 * // Route-specific 10MB limit for AI endpoints
 * app.post('/api/ai/*', bodyLimit({ maxSize: 10 * 1024 * 1024 }))
 * ```
 */
export function bodyLimit(config: BodyLimitConfig): MiddlewareHandler {
  const { maxSize, message = `Request body too large. Maximum size is ${formatBytes(maxSize)}`, skip } = config;

  return async (c: Context, next: Next) => {
    // Check skip condition
    if (skip?.(c)) {
      return next();
    }

    // Check Content-Length header for early rejection
    const contentLength = c.req.header('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (isNaN(size)) {
        return c.json(
          {
            error: 'Bad Request',
            message: 'Invalid Content-Length header',
          },
          400,
        );
      }

      if (size > maxSize) {
        return c.json(
          {
            error: 'Payload Too Large',
            message,
            maxSize,
            receivedSize: size,
            maxSizeFormatted: formatBytes(maxSize),
            receivedSizeFormatted: formatBytes(size),
          },
          413,
        );
      }
    }

    // For requests without Content-Length, check actual body size
    // This prevents chunked encoding attacks
    const rawBody = await c.req.raw.clone().text();
    const actualSize = new TextEncoder().encode(rawBody).length;

    if (actualSize > maxSize) {
      return c.json(
        {
          error: 'Payload Too Large',
          message,
          maxSize,
          receivedSize: actualSize,
          maxSizeFormatted: formatBytes(maxSize),
          receivedSizeFormatted: formatBytes(actualSize),
        },
        413,
      );
    }

    await next();
  };
}

/**
 * Common body limit configurations
 */
export const BodyLimits = {
  /** Standard limit for most endpoints: 1MB */
  STANDARD: 1024 * 1024,
  /** Higher limit for AI endpoints with image data: 10MB */
  AI_ENDPOINT: 10 * 1024 * 1024,
  /** Very small limit for webhook endpoints: 100KB */
  WEBHOOK: 100 * 1024,
};
