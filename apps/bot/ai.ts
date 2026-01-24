import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ThrottlingException,
  ServiceQuotaExceededException,
} from '@aws-sdk/client-bedrock-runtime'
import { z } from 'zod'
import $ from '@core/constants'

const client = new BedrockRuntimeClient({
  region: process.env[$.env.AWS_REGION] || $.aws.region,
})

const getModelId = () => process.env[$.env.BEDROCK_MODEL_ID] || $.bedrock.model

// Response cache
interface CacheEntry {
  response: string
  timestamp: number
  hits: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_SIZE = 100
const responseCache = new Map<string, CacheEntry>()

function getCacheKey(systemPrompt: string, userMessage: string): string {
  const input = `${systemPrompt}:${userMessage}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `text:${hash}`
}

function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key)
  if (!entry) return null

  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key)
    return null
  }

  entry.hits++
  return entry.response
}

function cacheResponse(key: string, response: string): void {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(responseCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)

    const toRemove = Math.ceil(MAX_CACHE_SIZE * 0.2)
    for (let i = 0; i < toRemove; i++) {
      responseCache.delete(entries[i][0])
    }
  }

  responseCache.set(key, {
    response,
    timestamp: Date.now(),
    hits: 0,
  })
}

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      const isRetryable =
        error instanceof ThrottlingException ||
        error instanceof ServiceQuotaExceededException ||
        (error instanceof Error && error.name === 'TimeoutError')

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw lastError
      }

      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

const claudeResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string(),
  })).min(1),
  stop_reason: z.string(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
})

export interface InvokeClaudeTextOptions {
  skipCache?: boolean
  timeoutMs?: number
}

export async function invokeClaudeText(
  systemPrompt: string,
  userMessage: string,
  options: InvokeClaudeTextOptions = {}
): Promise<string> {
  const { skipCache = false } = options

  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage)
    const cached = getCachedResponse(cacheKey)
    if (cached) return cached
  }

  const result = await withRetry(async () => {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }

    const command = new InvokeModelCommand({
      modelId: getModelId(),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })

    const response = await client.send(command)

    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    const responseBody = claudeResponseSchema.parse(rawBody)

    const textContent = responseBody.content[0]
    if (!textContent?.text) {
      throw new Error('AI model returned empty response')
    }

    return textContent.text
  }, 'invokeClaudeText')

  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage)
    cacheResponse(cacheKey, result)
  }

  return result
}

export async function invokeClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType = 'image/jpeg'
): Promise<string> {
  return withRetry(async () => {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
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
      }],
    }

    const command = new InvokeModelCommand({
      modelId: getModelId(),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })

    const response = await client.send(command)

    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    const responseBody = claudeResponseSchema.parse(rawBody)

    const textContent = responseBody.content[0]
    if (!textContent?.text) {
      throw new Error('AI model returned empty response')
    }

    return textContent.text
  }, 'invokeClaudeVision')
}

export const PARSER_SYSTEM_PROMPT = `You are a financial parsing assistant for Fracti, an expense splitting app. Your job is to extract structured expense data from natural language messages.

RULES:
1. Extract the payer (who paid), amount, currency, description, and beneficiaries (who the expense is split with)
2. If currency is not specified, assume TON
3. If no specific beneficiaries are mentioned, return an empty array
4. Provide a confidence score from 0 to 1
5. Always return valid JSON

OUTPUT FORMAT (return ONLY this JSON, no markdown, no explanation):
{
  "payer": "string or null if unclear",
  "amount": number,
  "currency": "TON" | "USD" | "EUR" | etc,
  "description": "string describing the expense",
  "beneficiaries": ["array", "of", "names"],
  "confidence": 0.0-1.0
}`

export const VISION_SYSTEM_PROMPT = `You are a receipt OCR specialist for Fracti, an expense splitting app. Your job is to extract itemized data from receipt images.

RULES:
1. Extract all line items with name, quantity, and price
2. Calculate the total if visible, otherwise sum the items
3. Extract tax amount if shown
4. Identify the merchant name if visible
5. Extract the date if visible (ISO format YYYY-MM-DD)
6. Provide a confidence score from 0 to 1
7. Always return valid JSON

OUTPUT FORMAT (return ONLY this JSON, no markdown, no explanation):
{
  "items": [{"name": "Item name", "quantity": 1, "price": 10.00}],
  "total": 10.00,
  "tax": 1.00,
  "currency": "TON" | "USD" | etc,
  "merchant": "Store name or null",
  "date": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0
}`

export interface ParsedExpense {
  payer: string | null
  amount: number
  currency: string
  description: string
  beneficiaries: string[]
  confidence: number
}

export interface ParsedReceipt {
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  tax?: number
  currency: string
  merchant?: string
  date?: string
  confidence: number
}

function parseExpenseFallback(message: string): ParsedExpense | null {
  const amountPatterns = [
    /(\d+(?:\.\d{1,2})?)\s*(TON|ton|USD|usd|EUR|eur|\$|€)/i,
    /(\$|€)\s*(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)\s*(bucks?|dollars?)/i,
  ]

  let amount: number | null = null
  let currency = 'TON'

  for (const pattern of amountPatterns) {
    const match = message.match(pattern)
    if (match) {
      if (match[1].match(/[\d.]/)) {
        amount = parseFloat(match[1])
        if (match[2]) {
          currency = normalizeCurrency(match[2])
        }
      } else {
        amount = parseFloat(match[2])
        currency = normalizeCurrency(match[1])
      }
      break
    }
  }

  if (!amount || amount <= 0) return null

  const descPatterns = [
    /for\s+(.+?)(?:\s+with|\s+between|\s*$)/i,
    /(?:paid|bought|spent)\s+(?:\d+\s*\w+\s+)?(?:for\s+)?(.+?)(?:\s+with|\s*$)/i,
  ]

  let description = 'expense'
  for (const pattern of descPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      description = match[1].trim().replace(/\s+/g, ' ').slice(0, 100)
      break
    }
  }

  const namePattern = /@(\w+)/g
  const beneficiaries: string[] = []
  let nameMatch
  while ((nameMatch = namePattern.exec(message)) !== null) {
    beneficiaries.push(nameMatch[1])
  }

  return {
    payer: null,
    amount,
    currency,
    description,
    beneficiaries,
    confidence: 0.3,
  }
}

function normalizeCurrency(input: string): string {
  const normalized = input.toLowerCase().trim()
  if (normalized === '$' || normalized.includes('dollar') || normalized.includes('buck') || normalized === 'usd') {
    return 'USD'
  }
  if (normalized === '€' || normalized === 'eur') {
    return 'EUR'
  }
  if (normalized === 'ton') {
    return 'TON'
  }
  return input.toUpperCase()
}

export interface AIResult<T> {
  success: boolean
  data?: T
  fallback?: boolean
  error?: string
}

export async function parseExpenseWithFallback(
  message: string
): Promise<AIResult<ParsedExpense>> {
  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, message)
    const parsed = JSON.parse(response) as ParsedExpense

    if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
      throw new Error('Invalid amount')
    }

    return { success: true, data: parsed, fallback: false }
  } catch {
    const fallbackResult = parseExpenseFallback(message)
    if (fallbackResult) {
      return { success: true, data: fallbackResult, fallback: true }
    }

    return { success: false, error: 'Could not parse expense from message' }
  }
}

export async function parseReceiptWithFallback(
  imageBase64: string,
  mediaType = 'image/jpeg'
): Promise<AIResult<ParsedReceipt>> {
  try {
    const response = await invokeClaudeVision(VISION_SYSTEM_PROMPT, imageBase64, mediaType)
    const parsed = JSON.parse(response) as ParsedReceipt

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('No items found in receipt')
    }

    return { success: true, data: parsed, fallback: false }
  } catch {
    return {
      success: false,
      error: 'Could not parse receipt from image. Please try again or enter manually.',
    }
  }
}
