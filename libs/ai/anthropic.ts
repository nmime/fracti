/**
 * Direct Anthropic API integration for self-hosted deployment
 *
 * This module provides the same interface as bedrock.ts but uses
 * the direct Anthropic API instead of AWS Bedrock.
 *
 * Usage:
 *   Set environment variables:
 *   - AI_PROVIDER=anthropic
 *   - ANTHROPIC_API_KEY=sk-ant-...
 *   - AI_MODEL=claude-3-5-haiku-20241022
 */

import { getCacheKey, getCachedResponse, cacheResponse } from './cache';
import { normalizeCurrency } from './currency';
import { PARSER_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from './prompts';
import { withRetry } from './retry';
import type {
  BedrockConfig,
  InvokeClaudeTextOptions,
  LoggerInterface,
  AIResult,
  ParsedExpense,
  ParsedReceipt,
} from './types';
import { DefaultCurrency } from '@libs/types';

interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

let currentConfig: AnthropicConfig | null = null;
let currentLogger: LoggerInterface | null = null;

/* eslint-disable no-console */
const defaultLogger: LoggerInterface = {
  debug: (message, context) => console.debug(message, context),
  info: (message, context) => console.info(message, context),
  warn: (message, context) => console.warn(message, context),
  error: (message, context, error) => console.error(message, context, error),
};
/* eslint-enable no-console */

/**
 * Initialize Anthropic client for self-hosted deployment
 */
export function initAnthropic(config: AnthropicConfig, logger?: LoggerInterface): void {
  currentConfig = config;
  currentLogger = logger ?? defaultLogger;
}

/**
 * Initialize from BedrockConfig for compatibility
 * Reads ANTHROPIC_API_KEY and AI_MODEL from environment
 */
export function initAnthropicFromEnv(_bedrockConfig: BedrockConfig, logger?: LoggerInterface): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required for self-hosted deployment');
  }

  const model = process.env.AI_MODEL ?? 'claude-3-5-haiku-20241022';

  initAnthropic({ apiKey, model }, logger);
}

function getConfig(): AnthropicConfig {
  if (!currentConfig) {
    throw new Error('Anthropic client not initialized. Call initAnthropic() first.');
  }
  return currentConfig;
}

function getLogger(): LoggerInterface {
  return currentLogger ?? defaultLogger;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

async function callAnthropicAPI(
  messages: AnthropicMessage[],
  systemPrompt: string,
  maxTokens: number,
): Promise<string> {
  const config = getConfig();
  const logger = getLogger();

  const response = await fetch(config.baseUrl ?? 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('Anthropic API error', { status: response.status, error });
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as AnthropicResponse;

  if (!data.content?.[0]?.text) {
    throw new Error('AI model returned empty response');
  }

  return data.content[0].text;
}

export async function invokeClaudeText(
  systemPrompt: string,
  userMessage: string,
  options: InvokeClaudeTextOptions = {},
): Promise<string> {
  const { skipCache = false } = options;
  const logger = getLogger();

  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      logger.debug('AI response cache hit', { cacheKey: cacheKey.slice(0, 20) });
      return cached;
    }
  }

  const result = await withRetry(
    async () => {
      return callAnthropicAPI([{ role: 'user', content: userMessage }], systemPrompt, 1024);
    },
    'invokeClaudeText',
    logger,
  );

  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage);
    cacheResponse(cacheKey, result);
  }

  return result;
}

export async function invokeClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType = 'image/jpeg',
): Promise<string> {
  const logger = getLogger();

  return withRetry(
    async () => {
      const messages: AnthropicMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract all items from this receipt. Return the data in the specified JSON format.',
            },
          ],
        },
      ];

      return callAnthropicAPI(messages, systemPrompt, 2048);
    },
    'invokeClaudeVision',
    logger,
  );
}

function parseExpenseFallback(message: string): ParsedExpense | null {
  const amountPatterns = [
    /(\d+(?:\.\d{1,2})?)\s*(TON|ton|USD|usd|EUR|eur|\$|€)/i,
    /(\$|€)\s*(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)\s*(bucks?|dollars?)/i,
  ];

  let amount: number | null = null;
  let currency = DefaultCurrency;

  for (const pattern of amountPatterns) {
    const match = message.match(pattern);
    if (match) {
      if (/[\d.]/.exec(match[1])) {
        amount = parseFloat(match[1]);
        if (match[2]) {
          currency = normalizeCurrency(match[2]);
        }
      } else {
        amount = parseFloat(match[2]);
        currency = normalizeCurrency(match[1]);
      }
      break;
    }
  }

  if (!amount || amount <= 0) return null;

  const descPatterns = [
    /for\s+(.+?)(?:\s+with|\s+between|\s*$)/i,
    /(?:paid|bought|spent)\s+(?:\d+\s*\w+\s+)?(?:for\s+)?(.+?)(?:\s+with|\s*$)/i,
  ];

  let description = 'expense';
  for (const pattern of descPatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      description = match[1].trim().replace(/\s+/g, ' ').slice(0, 100);
      break;
    }
  }

  const namePattern = /@(\w+)/g;
  const beneficiaries: string[] = [];
  let nameMatch;
  while ((nameMatch = namePattern.exec(message)) !== null) {
    beneficiaries.push(nameMatch[1]);
  }

  return {
    payer: null,
    amount,
    currency,
    description,
    beneficiaries,
    confidence: 0.3,
    category: null,
  };
}

export async function parseExpenseWithFallback(message: string): Promise<AIResult<ParsedExpense>> {
  const logger = getLogger();

  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, message);
    const parsed = JSON.parse(response) as ParsedExpense;

    if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
      throw new Error('Invalid amount');
    }

    return {
      success: true,
      data: parsed,
      fallback: false,
    };
  } catch (error) {
    logger.warn('AI expense parsing failed, using fallback', {
      messageLength: message.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const fallbackResult = parseExpenseFallback(message);
    if (fallbackResult) {
      return {
        success: true,
        data: fallbackResult,
        fallback: true,
      };
    }

    return {
      success: false,
      error: 'Could not parse expense from message',
    };
  }
}

export async function parseReceiptWithFallback(
  imageBase64: string,
  mediaType = 'image/jpeg',
): Promise<AIResult<ParsedReceipt>> {
  const logger = getLogger();

  try {
    const response = await invokeClaudeVision(VISION_SYSTEM_PROMPT, imageBase64, mediaType);
    const parsed = JSON.parse(response) as ParsedReceipt;

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('No items found in receipt');
    }

    return {
      success: true,
      data: parsed,
      fallback: false,
    };
  } catch (error) {
    logger.warn('AI receipt parsing failed', {
      mediaType,
      imageSize: imageBase64.length,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: 'Could not parse receipt from image. Please try again or enter manually.',
    };
  }
}
