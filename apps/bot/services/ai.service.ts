import { invokeClaudeText, invokeClaudeVision } from '../integrations/bedrock'
import { normalizeCurrency } from '../utils/currency'
import type { ParsedExpense, ParsedReceipt, AIResult } from '../types'

/**
 * AI Service - handles expense parsing and receipt OCR
 */

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
