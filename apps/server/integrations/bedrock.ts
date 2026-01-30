import {
  initBedrock,
  invokeClaudeText,
  invokeClaudeVision,
  parseExpenseWithFallback,
  parseReceiptWithFallback,
  getCacheStats,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
  type AIResult,
  type ParsedExpense,
  type ParsedReceipt,
  type InvokeClaudeTextOptions,
} from '@libs/ai';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize bedrock with server config
initBedrock(
  {
    region: config.AWS_REGION,
    modelId: config.BEDROCK_MODEL_ID,
  },
  logger,
);

// Re-export everything
export {
  invokeClaudeText,
  invokeClaudeVision,
  parseExpenseWithFallback,
  parseReceiptWithFallback,
  getCacheStats,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
};

export type { AIResult, ParsedExpense, ParsedReceipt, InvokeClaudeTextOptions };
