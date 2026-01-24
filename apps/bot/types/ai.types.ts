/**
 * AI-related type definitions for the bot
 */

export interface ParsedExpense {
  payer: string | null
  amount: number
  currency: string
  description: string
  beneficiaries: string[]
  confidence: number
}

export interface ParsedReceipt {
  items: ReceiptItem[]
  total: number
  tax?: number
  currency: string
  merchant?: string
  date?: string
  confidence: number
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

export interface AIResult<T> {
  success: boolean
  data?: T
  fallback?: boolean
  error?: string
}

export interface ClaudeResponse {
  content: Array<{ type: string; text: string }>
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface InvokeClaudeTextOptions {
  skipCache?: boolean
  timeoutMs?: number
}

export interface CacheEntry {
  response: string
  timestamp: number
  hits: number
}
