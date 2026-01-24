import { z } from 'zod'
import { logger } from './logger'

/**
 * Frontend configuration schema with Zod validation.
 * Uses Vite's import.meta.env for environment variables.
 */
const envSchema = z.object({
  // API base URL
  VITE_API_URL: z
    .string()
    .default('/api'),

  // TON Connect manifest URL
  VITE_TONCONNECT_MANIFEST_URL: z
    .string()
    .url()
    .default('https://fracti.app/tonconnect-manifest.json'),

  // Environment mode
  MODE: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Is development mode
  DEV: z
    .boolean()
    .default(true),

  // Is production mode
  PROD: z
    .boolean()
    .default(false),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables.
 * Logs warning in development if validation fails.
 */
function parseEnv(): Env {
  // Get all VITE_ prefixed env vars
  const envVars = {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_TONCONNECT_MANIFEST_URL: import.meta.env.VITE_TONCONNECT_MANIFEST_URL,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
  }

  const result = envSchema.safeParse(envVars)

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      return `${issue.path.join('.')}: ${issue.message}`
    })

    logger.warn('Invalid environment variables', { errors })

    // Return defaults for frontend (don't crash)
    return envSchema.parse({})
  }

  return result.data
}

/**
 * Validated configuration object.
 * Use this instead of import.meta.env directly.
 */
export const config = parseEnv()

/**
 * Derived configuration values
 */
export const apiConfig = {
  baseUrl: config.VITE_API_URL,
} as const

export const tonConfig = {
  manifestUrl: config.VITE_TONCONNECT_MANIFEST_URL,
} as const

/**
 * Helper flags
 */
export const isDevelopment = config.DEV
export const isProduction = config.PROD
