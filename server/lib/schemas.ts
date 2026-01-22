import { z } from 'zod'

// ============================================
// Common Schemas
// ============================================

export const groupIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
})

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
  wallet: z.string().optional(),
})

export const updateWalletSchema = z.object({
  wallet: z.string().min(1, 'Wallet address is required'),
})

// ============================================
// Expense Schemas
// ============================================

export const splitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive().optional(),
})

export const createExpenseSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  splitType: z.enum(['equal', 'exact', 'percentage']).default('equal'),
  splits: z.array(splitSchema).min(1, 'At least one split required'),
})

// ============================================
// Settlement Schemas
// ============================================

export const createSettlementSchema = z.object({
  toId: z.string().min(1, 'Recipient ID is required'),
  amount: z.number().positive('Amount must be positive'),
  txHash: z.string().optional(),
})

export const updateSettlementSchema = z.object({
  txHash: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'failed']).optional(),
})

// ============================================
// AI Schemas
// ============================================

export const parseTextSchema = z.object({
  text: z.string().min(1, 'Text is required').max(1000, 'Text too long'),
  context: z
    .object({
      members: z.array(z.string()).optional(),
      groupId: z.string().optional(),
    })
    .optional(),
})

export const parseVisionSchema = z.object({
  image: z.string().min(1, 'Image (base64) is required'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).default('image/jpeg'),
})

// ============================================
// Response Types (for documentation)
// ============================================

export type ApiError = {
  error: string
  message: string
  details?: unknown
}

export type ApiSuccess<T> = {
  success: true
  data: T
}

// Inferred types for use in handlers
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
export type ParseTextInput = z.infer<typeof parseTextSchema>
export type ParseVisionInput = z.infer<typeof parseVisionSchema>
