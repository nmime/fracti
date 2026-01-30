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

// Unified client with lazy initialization (recommended)
export {
  initAIClient,
  getProvider,
  invokeClaudeText,
  invokeClaudeVision,
  parseExpenseWithFallback,
  parseReceiptWithFallback,
} from './client';

// Legacy: Direct Bedrock client (AWS)
export {
  initBedrock,
  invokeClaudeText as invokeClaudeTextBedrock,
  invokeClaudeVision as invokeClaudeVisionBedrock,
  parseExpenseWithFallback as parseExpenseWithFallbackBedrock,
  parseReceiptWithFallback as parseReceiptWithFallbackBedrock,
} from './bedrock';

// Legacy: Direct Anthropic client (self-hosted)
export {
  initAnthropic,
  initAnthropicFromEnv,
  invokeClaudeText as invokeClaudeTextAnthropic,
  invokeClaudeVision as invokeClaudeVisionAnthropic,
  parseExpenseWithFallback as parseExpenseWithFallbackAnthropic,
  parseReceiptWithFallback as parseReceiptWithFallbackAnthropic,
} from './anthropic';

// GPT4Free client (free, no API key required)
export {
  initG4F,
  initG4FFromEnv,
  invokeClaudeText as invokeClaudeTextG4F,
  invokeClaudeVision as invokeClaudeVisionG4F,
  parseExpenseWithFallback as parseExpenseWithFallbackG4F,
  parseReceiptWithFallback as parseReceiptWithFallbackG4F,
} from './g4f';
