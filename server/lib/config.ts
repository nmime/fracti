import { z } from 'zod'

/**
 * Server configuration schema with Zod validation.
 * All environment variables are validated at startup.
 */
const envSchema = z.object({
  // Node environment - defaults to 'production' for security (secure by default)
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('production'),

  // AWS SAM local development flag
  AWS_SAM_LOCAL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // DynamoDB
  TABLE_NAME: z
    .string()
    .min(1, 'TABLE_NAME is required'),

  // S3 for avatars
  S3_BUCKET_NAME: z
    .string()
    .min(1, 'S3_BUCKET_NAME is required'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z
    .string()
    .min(1, 'TELEGRAM_BOT_TOKEN is required'),

  MINI_APP_URL: z
    .string()
    .url()
    .default('https://t.me/FractiBot/app'),

  // AWS Bedrock
  BEDROCK_MODEL_ID: z
    .string()
    .default('anthropic.claude-3-5-sonnet-20241022-v2:0'),

  // AWS Region (for Bedrock)
  AWS_REGION: z
    .string()
    .default('us-east-1'),

  // CORS - comma-separated list of allowed origins
  ALLOWED_ORIGINS: z
    .string()
    .default('https://t.me,https://web.telegram.org')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables.
 * Throws detailed error if validation fails.
 */
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      return `  - ${issue.path.join('.')}: ${issue.message}`
    })

    // Throw with detailed message - logging handled by caller
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\nPlease check your .env file or environment configuration.`
    )
  }

  return result.data
}

/**
 * Validated configuration object.
 * Use this instead of process.env directly.
 */
export const config = parseEnv()

/**
 * Helper flags for common checks
 */
export const isDevelopment = config.NODE_ENV === 'development'
export const isProduction = config.NODE_ENV === 'production'
export const isTest = config.NODE_ENV === 'test'
export const isLocalDev = config.AWS_SAM_LOCAL || isDevelopment

/**
 * Get allowed origins for CORS
 * In development, restrict to localhost variants
 */
export function getAllowedOrigins(): string[] {
  if (isLocalDev) {
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ]
  }
  return config.ALLOWED_ORIGINS
}
