import {
  initBedrock,
  invokeClaudeText,
  invokeClaudeVision,
  type AIResult,
  type ParsedExpense,
  type ParsedReceipt,
  type InvokeClaudeTextOptions,
} from '@libs/ai';
import { getAwsRegion, getBedrockModelId } from '../config';

// Initialize bedrock with bot config
initBedrock({
  region: getAwsRegion(),
  modelId: getBedrockModelId(),
});

// Re-export everything
export { invokeClaudeText, invokeClaudeVision };

export type { AIResult, ParsedExpense, ParsedReceipt, InvokeClaudeTextOptions };
