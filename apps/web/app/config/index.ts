import { z } from 'zod'
import { logger } from '../utils/logger'

/**
 * Frontend configuration with Zod validation
 */

const envSchema = z.object({
  VITE_API_URL: z.string().default('/api'),
  VITE_TONCONNECT_MANIFEST_URL: z
    .string()
    .url()
    .default('https://fracti.app/tonconnect-manifest.json'),
  MODE: z.enum(['development', 'production', 'test']).default('development'),
  DEV: z.boolean().default(true),
  PROD: z.boolean().default(false),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
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
    return envSchema.parse({})
  }

  return result.data
}

export const config = parseEnv()

export const apiConfig = {
  baseUrl: config.VITE_API_URL,
} as const

export const tonConfig = {
  manifestUrl: config.VITE_TONCONNECT_MANIFEST_URL,
} as const

export const isDevelopment = config.DEV
export const isProduction = config.PROD
