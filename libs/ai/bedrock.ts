import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DefaultCurrency } from '@libs/types';
import { getCacheKey, getCachedResponse, cacheResponse } from './cache';
import { normalizeCurrency } from './currency';
import { PARSER_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from './prompts';
import { withRetry } from './retry';
import { claudeResponseSchema } from './schemas';
import type {
  BedrockConfig,
  InvokeClaudeTextOptions,
  LoggerInterface,
  AIResult,
  ParsedExpense,
  ParsedReceipt,
} from './types';

/**
 * AWS Bedrock integration for Claude AI
 */

let client: BedrockRuntimeClient | null = null;
let currentConfig: BedrockConfig | null = null;
let currentLogger: LoggerInterface | null = null;

// Default console-based logger
/* eslint-disable no-console */
const defaultLogger: LoggerInterface = {
  debug: (message, context) => {
    console.debug(message, context);
  },
  info: (message, context) => {
    console.info(message, context);
  },
  warn: (message, context) => {
    console.warn(message, context);
  },
  error: (message, context, error) => {
    console.error(message, context, error);
  },
};
/* eslint-enable no-console */

export function initBedrock(config: BedrockConfig, logger?: LoggerInterface): void {
  currentConfig = config;
  currentLogger = logger ?? defaultLogger;
  client = new BedrockRuntimeClient({ region: config.region });
}

function getClient(): BedrockRuntimeClient {
  if (!client || !currentConfig) {
    throw new Error('Bedrock client not initialized. Call initBedrock() first.');
  }

  return client;
}

function getConfig(): BedrockConfig {
  if (!currentConfig) {
    throw new Error('Bedrock client not initialized. Call initBedrock() first.');
  }

  return currentConfig;
}

function getLogger(): LoggerInterface {
  return currentLogger ?? defaultLogger;
}

function isNovaModel(modelId: string): boolean {
  return modelId.includes('amazon.nova');
}

function buildPayload(modelId: string, systemPrompt: string, userMessage: string, maxTokens: number) {
  if (isNovaModel(modelId)) {
    return {
      schemaVersion: 'messages-v1',
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      system: [{ text: systemPrompt }],
      inferenceConfig: { max_new_tokens: maxTokens },
    };
  }

  return {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };
}

function extractTextFromResponse(modelId: string, rawBody: Record<string, unknown>): string {
  if (isNovaModel(modelId)) {
    const output = rawBody.output as { message?: { content?: { text?: string }[] } } | undefined;
    const text = output?.message?.content?.[0]?.text;
    if (!text) throw new Error('AI model returned empty response');

    return text;
  }

  const responseBody = claudeResponseSchema.parse(rawBody);
  const textContent = responseBody.content[0];
  if (!textContent?.text) throw new Error('AI model returned empty response');

  return textContent.text;
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
      const modelId = getConfig().modelId;
      const payload = buildPayload(modelId, systemPrompt, userMessage, 1024);

      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await getClient().send(command);
      const rawBody = JSON.parse(new TextDecoder().decode(response.body));

      try {
        return extractTextFromResponse(modelId, rawBody);
      } catch {
        logger.error('Invalid Bedrock response format', {
          modelId,
          promptLength: userMessage.length,
        });

        throw new Error('Invalid response from AI model');
      }
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
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
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
        ],
      };

      const command = new InvokeModelCommand({
        modelId: getConfig().modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await getClient().send(command);
      const rawBody = JSON.parse(new TextDecoder().decode(response.body));

      let responseBody;
      try {
        responseBody = claudeResponseSchema.parse(rawBody);
      } catch {
        logger.error('Invalid Bedrock vision response format', {
          modelId: getConfig().modelId,
          mediaType,
          imageSize: imageBase64.length,
        });

        throw new Error('Invalid response from AI model');
      }

      const textContent = responseBody.content[0];
      if (!textContent?.text) {
        throw new Error('AI model returned empty response');
      }

      return textContent.text;
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
