/**
 * Unified AI Client with lazy initialization
 *
 * Automatically initializes on first use based on environment:
 * - AI_PROVIDER=bedrock (default) → AWS Bedrock
 * - AI_PROVIDER=anthropic → Direct Anthropic API
 * - AI_PROVIDER=g4f → GPT4Free (free, no API key required!)
 *
 * G4F Configuration:
 *   - G4F_PROVIDER=pollinations (default) | deepinfra | puter | custom
 *   - G4F_MODEL=gpt-4o-mini (default)
 *   - G4F_BASE_URL=http://localhost:1337/v1 (for custom/self-hosted)
 *
 * Usage:
 *   import { invokeClaudeText, parseExpenseWithFallback } from '@libs/ai/client';
 *   // No init needed - auto-initializes on first call
 */

import type {
  BedrockConfig,
  LoggerInterface,
  AIResult,
  ParsedExpense,
  ParsedReceipt,
  InvokeClaudeTextOptions,
} from './types';

// Lazy-loaded modules
let bedrockModule: typeof import('./bedrock') | null = null;
let anthropicModule: typeof import('./anthropic') | null = null;
let g4fModule: typeof import('./g4f') | null = null;

// Initialization state
let initialized = false;
let activeProvider: 'bedrock' | 'anthropic' | 'g4f' = 'bedrock';

// Default logger
/* eslint-disable no-console */
const defaultLogger: LoggerInterface = {
  debug: (message, context) => console.debug(message, context),
  info: (message, context) => console.info(message, context),
  warn: (message, context) => console.warn(message, context),
  error: (message, context, error) => console.error(message, context, error),
};
/* eslint-enable no-console */

/**
 * Get config from environment variables
 */
function getConfigFromEnv(): BedrockConfig {
  return {
    region: process.env.AWS_REGION ?? 'us-east-1',
    modelId: process.env.AI_MODEL ?? process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  };
}

/**
 * Lazy initialize the appropriate provider
 */
function ensureInitialized(logger?: LoggerInterface): void {
  if (initialized) return;

  const provider = process.env.AI_PROVIDER ?? 'bedrock';
  const config = getConfigFromEnv();
  const log = logger ?? defaultLogger;

  if (provider === 'g4f') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    g4fModule = require('./g4f') as typeof import('./g4f');
    g4fModule.initG4FFromEnv(config, log);
    activeProvider = 'g4f';
    log.info('AI client initialized', {
      provider: 'g4f',
      baseUrl: process.env.G4F_BASE_URL ?? 'https://api.g4f.dev/v1',
      model: process.env.G4F_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini',
    });
  } else if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    anthropicModule = require('./anthropic') as typeof import('./anthropic');
    anthropicModule.initAnthropicFromEnv(config, log);
    activeProvider = 'anthropic';
    log.info('AI client initialized', { provider: 'anthropic', model: process.env.AI_MODEL });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bedrockModule = require('./bedrock') as typeof import('./bedrock');
    bedrockModule.initBedrock(config, log);
    activeProvider = 'bedrock';
    log.info('AI client initialized', { provider: 'bedrock', model: config.modelId });
  }

  initialized = true;
}

/**
 * Manually initialize with custom config (optional)
 */
export function initAIClient(config?: BedrockConfig, logger?: LoggerInterface): void {
  if (initialized) return;

  const provider = process.env.AI_PROVIDER ?? 'bedrock';
  const cfg = config ?? getConfigFromEnv();
  const log = logger ?? defaultLogger;

  if (provider === 'g4f') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    g4fModule = require('./g4f') as typeof import('./g4f');
    g4fModule.initG4FFromEnv(cfg, log);
    activeProvider = 'g4f';
  } else if (provider === 'anthropic') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    anthropicModule = require('./anthropic') as typeof import('./anthropic');
    anthropicModule.initAnthropicFromEnv(cfg, log);
    activeProvider = 'anthropic';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bedrockModule = require('./bedrock') as typeof import('./bedrock');
    bedrockModule.initBedrock(cfg, log);
    activeProvider = 'bedrock';
  }

  initialized = true;
}

/**
 * Get current provider name
 */
export function getProvider(): string {
  ensureInitialized();
  return activeProvider;
}

/**
 * Invoke Claude with text
 */
export async function invokeClaudeText(
  systemPrompt: string,
  userMessage: string,
  options: InvokeClaudeTextOptions = {},
): Promise<string> {
  ensureInitialized();

  if (activeProvider === 'g4f') {
    return g4fModule!.invokeClaudeText(systemPrompt, userMessage, options);
  }
  if (activeProvider === 'anthropic') {
    return anthropicModule!.invokeClaudeText(systemPrompt, userMessage, options);
  }
  return bedrockModule!.invokeClaudeText(systemPrompt, userMessage, options);
}

/**
 * Invoke Claude with vision (image)
 */
export async function invokeClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType?: string,
): Promise<string> {
  ensureInitialized();

  if (activeProvider === 'g4f') {
    return g4fModule!.invokeClaudeVision(systemPrompt, imageBase64, mediaType);
  }
  if (activeProvider === 'anthropic') {
    return anthropicModule!.invokeClaudeVision(systemPrompt, imageBase64, mediaType);
  }
  return bedrockModule!.invokeClaudeVision(systemPrompt, imageBase64, mediaType);
}

/**
 * Parse expense with AI + regex fallback
 */
export async function parseExpenseWithFallback(message: string): Promise<AIResult<ParsedExpense>> {
  ensureInitialized();

  if (activeProvider === 'g4f') {
    return g4fModule!.parseExpenseWithFallback(message);
  }
  if (activeProvider === 'anthropic') {
    return anthropicModule!.parseExpenseWithFallback(message);
  }
  return bedrockModule!.parseExpenseWithFallback(message);
}

/**
 * Parse receipt image with AI
 */
export async function parseReceiptWithFallback(
  imageBase64: string,
  mediaType?: string,
): Promise<AIResult<ParsedReceipt>> {
  ensureInitialized();

  if (activeProvider === 'g4f') {
    return g4fModule!.parseReceiptWithFallback(imageBase64, mediaType);
  }
  if (activeProvider === 'anthropic') {
    return anthropicModule!.parseReceiptWithFallback(imageBase64, mediaType);
  }
  return bedrockModule!.parseReceiptWithFallback(imageBase64, mediaType);
}
