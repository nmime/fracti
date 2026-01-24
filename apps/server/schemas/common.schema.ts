import { z } from 'zod'

/**
 * Safe amount validator - prevents overflow and ensures reasonable bounds
 */
export const safeAmount = z
  .number()
  .positive('Amount must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'Amount too large')
  .refine((n) => Number.isFinite(n), 'Amount must be a finite number')

/**
 * TON wallet address validator
 */
export const tonWalletAddress = z
  .string()
  .regex(/^(EQ|UQ)[A-Za-z0-9_-]{46}$/, 'Invalid TON wallet address format')

/**
 * Currency code validator
 */
export const currencyCode = z
  .string()
  .min(2, 'Currency code too short')
  .max(5, 'Currency code too long')
  .toUpperCase()

/**
 * Transaction hash validator (64 hex characters)
 */
export const txHash = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'Invalid transaction hash format')

/**
 * Base64 image validator with size limit
 */
export const base64Image = z
  .string()
  .min(1, 'Image is required')
  .max(1_400_000, 'Image too large (max 1MB)')
  .refine((s) => /^[A-Za-z0-9+/=]+$/.test(s), 'Invalid base64 encoding')
  .refine((s) => s.length % 4 === 0, 'Invalid base64 padding')

/**
 * Pagination query schema
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

/**
 * Group ID param schema
 */
export const groupIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
