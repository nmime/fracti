/**
 * AI integration for server
 * Uses unified client from @libs/ai with lazy initialization
 */

export {
  invokeClaudeText,
  invokeClaudeVision,
  parseExpenseWithFallback,
  parseReceiptWithFallback,
  getProvider,
  getCacheStats,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
  type AIResult,
  type ParsedExpense,
  type ParsedReceipt,
  type InvokeClaudeTextOptions,
} from '@libs/ai';
