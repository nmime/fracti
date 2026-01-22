import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { invokeClaudeText, PARSER_SYSTEM_PROMPT } from '../../lib/bedrock'
import { json, error } from '../../lib/response'

interface ParsedExpense {
  payer: string | null
  amount: number
  currency: string
  description: string
  beneficiaries: string[]
  confidence: number
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { message } = body

    if (!message || typeof message !== 'string') {
      return error('Missing or invalid message field')
    }

    if (message.length > 1000) {
      return error('Message too long (max 1000 characters)')
    }

    console.log('Parsing message:', message)

    // Call Claude to parse the message
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, message)

    console.log('Claude response:', response)

    // Parse the JSON response
    let parsed: ParsedExpense

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError)
      return error('Failed to parse AI response')
    }

    // Validate the parsed response
    if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
      return error('Could not extract a valid amount from the message')
    }

    // Normalize the response
    const result: ParsedExpense = {
      payer: parsed.payer || null,
      amount: parsed.amount,
      currency: parsed.currency || 'TON',
      description: parsed.description || 'Expense',
      beneficiaries: Array.isArray(parsed.beneficiaries)
        ? parsed.beneficiaries
        : [],
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    }

    return json(result)
  } catch (err) {
    console.error('Parser handler error:', err)

    // Check if it's a Bedrock error
    if (err instanceof Error && err.name === 'AccessDeniedException') {
      return error('AI service not configured', 503)
    }

    return error('Failed to parse message', 500)
  }
}
