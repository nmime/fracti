import { z } from 'zod'

/**
 * Server configuration schema with Zod validation.
 * All environment variables are validated at startup.
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // AWS SAM local development flag
  AWS_SAM_LOCAL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  // DynamoDB
  TABLE_NAME: z
    .string()
    .min(1, 'TABLE_NAME is required'),

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

    console.error('❌ Invalid environment variables:')
    console.error(errors.join('\n'))
    console.error('\nPlease check your .env file or environment configuration.')

    throw new Error(`Environment validation failed:\n${errors.join('\n')}`)
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
