/**
 * GPT4Free (g4f) integration for free AI access
 *
 * Uses the OpenAI-compatible API provided by g4f services.
 * No API key required for most providers!
 *
 * Setup options:
 * 1. Use g4f.dev API directly (default): https://api.g4f.dev/v1
 * 2. Self-host: docker run -p 1337:1337 hlohaus789/g4f
 * 3. Local: pip install -U g4f[api] && python -m g4f --port 1337
 *
 * Usage:
 *   Set environment variables:
 *   - AI_PROVIDER=g4f
 *   - G4F_BASE_URL=https://api.g4f.dev/v1 (default) or http://localhost:1337/v1
 *   - G4F_MODEL=gpt-4o-mini (default)
 *
 * Available models (via g4f.dev):
 *   - gpt-4o, gpt-4o-mini, gpt-4.1 (OpenAI)
 *   - claude-3.5-sonnet, claude-3-haiku (Anthropic)
 *   - deepseek-v3, deepseek-r1 (DeepSeek)
 *   - gemini-2.0-flash (Google)
 *
 * @see https://g4f.dev/docs/client_js.html
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

interface G4FConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

let currentConfig: G4FConfig | null = null;
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
 * Initialize G4F client
 */
export function initG4F(config: G4FConfig, logger?: LoggerInterface): void {
  currentConfig = config;
  currentLogger = logger ?? defaultLogger;
}

/**
 * Initialize from BedrockConfig for compatibility
 * Reads G4F_BASE_URL, G4F_MODEL from environment
 */
export function initG4FFromEnv(_bedrockConfig: BedrockConfig, logger?: LoggerInterface): void {
  const baseUrl = process.env.G4F_BASE_URL ?? 'https://api.g4f.dev/v1';
  const model = process.env.G4F_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini';
  const apiKey = process.env.G4F_API_KEY;

  initG4F({ baseUrl, model, apiKey }, logger);
}

function getConfig(): G4FConfig {
  if (!currentConfig) {
    throw new Error('G4F client not initialized. Call initG4F() first.');
  }
  return currentConfig;
}

function getLogger(): LoggerInterface {
  return currentLogger ?? defaultLogger;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
}

interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callG4FAPI(
  messages: OpenAIMessage[],
  maxTokens: number,
): Promise<string> {
  const config = getConfig();
  const logger = getLogger();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('G4F API error', { status: response.status, error });
    throw new Error(`G4F API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as OpenAIResponse;

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('AI model returned empty response');
  }

  return data.choices[0].message.content;
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

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const result = await withRetry(
    async () => callG4FAPI(messages, 1024),
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
      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract all items from this receipt. Return the data in the specified JSON format.',
            },
          ],
        },
      ];

      return callG4FAPI(messages, 2048);
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
