import {
  parseExpenseWithFallback,
  parseReceiptWithFallback,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
  type ParsedExpense,
  type ParsedReceipt,
  type AIResult,
} from '@libs/ai';

/**
 * AI Service - handles expense parsing and receipt OCR
 * Re-exports from shared library
 */

export { parseExpenseWithFallback, parseReceiptWithFallback, PARSER_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT };

export type { ParsedExpense, ParsedReceipt, AIResult };
