import { z } from 'zod'
import { base64Image } from './common.schema'

export const parseTextSchema = z.object({
  text: z.string().min(1, 'Text is required').max(1000, 'Text too long').trim(),
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

export type ParseTextInput = z.infer<typeof parseTextSchema>
export type ParseVisionInput = z.infer<typeof parseVisionSchema>
export type ParsedExpense = z.infer<typeof parsedExpenseSchema>
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>
