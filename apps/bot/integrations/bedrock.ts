/**
 * AI integration for bot
 * Uses unified client from @libs/ai with lazy initialization
 */

export {
  invokeClaudeText,
  invokeClaudeVision,
  getProvider,
  type AIResult,
  type ParsedExpense,
  type ParsedReceipt,
  type InvokeClaudeTextOptions,
} from '@libs/ai';
