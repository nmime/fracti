import { z } from 'zod'

// ============================================
// Custom Validators
// ============================================

/**
 * Safe amount validator - prevents overflow and ensures reasonable bounds
 */
const safeAmount = z
  .number()
  .positive('Amount must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'Amount too large')
  .refine((n) => Number.isFinite(n), 'Amount must be a finite number')

/**
 * TON wallet address validator
 * Format: EQ or UQ prefix followed by 46 base64url characters
 */
const tonWalletAddress = z
  .string()
  .regex(
    /^(EQ|UQ)[A-Za-z0-9_-]{46}$/,
    'Invalid TON wallet address format'
  )

/**
 * Base64 image validator with size limit
 * Max 1MB base64 encoded (~750KB raw image)
 */
const base64Image = z
  .string()
  .min(1, 'Image is required')
  .max(1_400_000, 'Image too large (max 1MB)')
  .refine(
    (s) => /^[A-Za-z0-9+/=]+$/.test(s),
    'Invalid base64 encoding'
  )
  .refine(
    (s) => s.length % 4 === 0,
    'Invalid base64 padding'
  )

/**
 * Transaction hash validator (64 hex characters)
 */
const txHash = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'Invalid transaction hash format')

// ============================================
// Common Schemas
// ============================================

export const groupIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
})

// ============================================
// Pagination Schemas
// ============================================

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

/**
 * Decode a base64 cursor to DynamoDB LastEvaluatedKey
 */
export function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'))
  } catch {
    return undefined
  }
}

/**
 * Encode DynamoDB LastEvaluatedKey to a base64 cursor
 */
export function encodeCursor(lastKey: Record<string, unknown> | undefined): string | undefined {
  if (!lastKey) return undefined
  return Buffer.from(JSON.stringify(lastKey)).toString('base64url')
}

export const expenseIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  expenseId: z.string().uuid('Invalid expense ID'),
})

export const settlementIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  settlementId: z.string().uuid('Invalid settlement ID'),
})

// ============================================
// Group Schemas
// ============================================

export const createGroupSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  chatId: z.union([z.string(), z.number()]).transform(String),
})

export const joinGroupSchema = z.object({
  wallet: tonWalletAddress.optional(),
})

export const updateWalletSchema = z.object({
  wallet: tonWalletAddress,
})

// ============================================
// Expense Schemas
// ============================================

/**
 * Currency code validator
 */
const currencyCode = z
  .string()
  .min(2, 'Currency code too short')
  .max(5, 'Currency code too long')
  .toUpperCase()

/**
 * Expense category validator
 */
const expenseCategory = z
  .enum([
    'food',
    'transport',
    'entertainment',
    'shopping',
    'utilities',
    'rent',
    'travel',
    'health',
    'education',
    'other',
  ])
  .optional()

export const splitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: safeAmount.optional(),
  percentage: z.number().min(0).max(100).optional(),
})

export const createExpenseSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  amount: safeAmount,
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description too long')
    .trim(),
  splitType: z.enum(['equal', 'exact', 'percentage']).default('equal'),
  splits: z.array(splitSchema).min(1, 'At least one split required').max(50, 'Too many splits'),
  currency: currencyCode.optional(),
  category: expenseCategory,
})

// ============================================
// Settlement Schemas
// ============================================

export const createSettlementSchema = z.object({
  toId: z.string().min(1, 'Recipient ID is required'),
  amount: safeAmount,
  txHash: txHash.optional(),
})

export const updateSettlementSchema = z.object({
  txHash: txHash.optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
})

// ============================================
// AI Schemas
// ============================================

export const parseTextSchema = z.object({
  text: z
    .string()
    .min(1, 'Text is required')
    .max(1000, 'Text too long')
    .trim(),
  context: z
    .object({
      members: z.array(z.string()).max(100).optional(),
      groupId: z.string().optional(),
    })
    .optional(),
})

export const parseVisionSchema = z.object({
  image: base64Image,
  mimeType: z
    .enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    .default('image/jpeg'),
})

// ============================================
// Parsed AI Response Schemas
// ============================================

export const parsedExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string(),
  payer: z.string().optional(),
  beneficiaries: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
})

export const parsedReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive().default(1),
  price: z.number().positive(),
})

export const parsedReceiptSchema = z.object({
  items: z.array(parsedReceiptItemSchema),
  total: z.number().positive(),
  tax: z.number().optional(),
  subtotal: z.number().optional(),
  currency: z.string().default('TON'),
  merchant: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

// ============================================
// Response Types
// ============================================

export type ApiError = {
  success: false
  error: string
  message?: string
  details?: unknown
  requestId?: string
}

export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ============================================
// Inferred Types
// ============================================

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>
export type ParseTextInput = z.infer<typeof parseTextSchema>
export type ParseVisionInput = z.infer<typeof parseVisionSchema>
export type ParsedExpense = z.infer<typeof parsedExpenseSchema>
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>
