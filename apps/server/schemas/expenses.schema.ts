import { z } from 'zod'
import { safeAmount, currencyCode } from './common.schema'

/**
 * Expense category validator
 */
export const expenseCategory = z
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

export const expenseIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  expenseId: z.string().uuid('Invalid expense ID'),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type ExpenseIdParam = z.infer<typeof expenseIdParamSchema>
