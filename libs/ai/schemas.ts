import { DefaultCurrency } from '@libs/types';
import { z } from 'zod';

/**
 * AI response schemas
 */

export const claudeResponseSchema = z.object({
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string(),
      }),
    )
    .min(1, 'Response must contain at least one content block'),
  stop_reason: z.string(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});

export const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
});

export const parsedExpenseSchema = z.object({
  payer: z.string().nullable(),
  amount: z.number().positive(),
  currency: z.string().default(DefaultCurrency),
  description: z.string(),
  beneficiaries: z.array(z.string()),
  category: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export const parsedReceiptSchema = z.object({
  items: z.array(receiptItemSchema).min(1),
  total: z.number(),
  tax: z.number().optional(),
  currency: z.string().default(DefaultCurrency),
  merchant: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
