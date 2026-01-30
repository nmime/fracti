/**
 * @libs/ai - Shared AI integration utilities
 */

// Types
export type {
  ParsedExpense,
  ParsedReceipt,
  ReceiptItem,
  AIResult,
  ClaudeResponse,
  InvokeClaudeTextOptions,
  CacheEntry,
  BedrockConfig,
  LoggerInterface,
} from './types';

// Cache utilities
export { getCacheKey, getCachedResponse, cacheResponse, clearCache, getCacheStats } from './cache';

// Retry utilities
export { withRetry } from './retry';

// Currency utilities
export { normalizeCurrency } from './currency';

// Schemas
export { claudeResponseSchema, parsedExpenseSchema, parsedReceiptSchema, receiptItemSchema } from './schemas';

// System prompts
export { PARSER_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from './prompts';

// Bedrock client
export {
  initBedrock,
  invokeClaudeText,
  invokeClaudeVision,
  parseExpenseWithFallback,
  parseReceiptWithFallback,
} from './bedrock';
