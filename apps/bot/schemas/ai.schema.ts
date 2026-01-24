import { z } from 'zod'

/**
 * Zod schemas for AI response validation
 */

export const claudeResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string(),
  })).min(1),
  stop_reason: z.string(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
})

export const parsedExpenseSchema = z.object({
  payer: z.string().nullable(),
  amount: z.number().positive(),
  currency: z.string().default('TON'),
  description: z.string(),
  beneficiaries: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
})

export const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().default(1),
  price: z.number(),
})

export const parsedReceiptSchema = z.object({
  items: z.array(receiptItemSchema).min(1),
  total: z.number(),
  tax: z.number().optional(),
  currency: z.string().default('TON'),
  merchant: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
})

export type ParsedExpenseInput = z.infer<typeof parsedExpenseSchema>
export type ParsedReceiptInput = z.infer<typeof parsedReceiptSchema>
