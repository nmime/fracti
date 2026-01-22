import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { z } from 'zod'
import { config } from './config'
import { logger } from './logger'

const client = new BedrockRuntimeClient({
  region: config.AWS_REGION,
})

const MODEL_ID = config.BEDROCK_MODEL_ID

// Zod schema for Claude API response validation
const claudeResponseSchema = z.object({
  content: z.array(z.object({
    type: z.string(),
    text: z.string(),
  })).min(1, 'Response must contain at least one content block'),
  stop_reason: z.string(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
})

export async function invokeClaudeText(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  }

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await client.send(command)

  // Parse and validate response with Zod
  let responseBody: z.infer<typeof claudeResponseSchema>
  try {
    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    responseBody = claudeResponseSchema.parse(rawBody)
  } catch (error) {
    logger.error('Invalid Bedrock response format', {
      modelId: MODEL_ID,
      promptLength: userMessage.length,
    }, error)
    throw new Error('Invalid response from AI model')
  }

  // Safe array access (validated by Zod min(1))
  const textContent = responseBody.content[0]
  if (!textContent?.text) {
    throw new Error('AI model returned empty response')
  }

  return textContent.text
}

export async function invokeClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType: string = 'image/jpeg'
): Promise<string> {
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
  }

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await client.send(command)

  // Parse and validate response with Zod
  let responseBody: z.infer<typeof claudeResponseSchema>
  try {
    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    responseBody = claudeResponseSchema.parse(rawBody)
  } catch (error) {
    logger.error('Invalid Bedrock vision response format', {
      modelId: MODEL_ID,
      mediaType,
      imageSize: imageBase64.length,
    }, error)
    throw new Error('Invalid response from AI model')
  }

  // Safe array access (validated by Zod min(1))
  const textContent = responseBody.content[0]
  if (!textContent?.text) {
    throw new Error('AI model returned empty response')
  }

  return textContent.text
}

// System prompts for different AI agents

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
}

EXAMPLES:
Input: "I paid 50 TON for dinner with Alice and Bob"
Output: {"payer": null, "amount": 50, "currency": "TON", "description": "dinner", "beneficiaries": ["Alice", "Bob"], "confidence": 0.95}

Input: "@John bought groceries for 25"
Output: {"payer": "John", "amount": 25, "currency": "TON", "description": "groceries", "beneficiaries": [], "confidence": 0.85}

Input: "split uber 30 bucks between everyone"
Output: {"payer": null, "amount": 30, "currency": "USD", "description": "uber", "beneficiaries": [], "confidence": 0.80}`

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
  "items": [
    {"name": "Item name", "quantity": 1, "price": 10.00}
  ],
  "total": 10.00,
  "tax": 1.00,
  "currency": "TON" | "USD" | etc,
  "merchant": "Store name or null",
  "date": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0
}

NOTES:
- If you cannot read an item, skip it
- Prices should be numbers, not strings
- If currency is ambiguous, default to the most common currency for the merchant's country
- Round prices to 2 decimal places`
