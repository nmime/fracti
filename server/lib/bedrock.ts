import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({})

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

interface ClaudeContentBlock {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>
  stop_reason: string
  usage: { input_tokens: number; output_tokens: number }
}

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
  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body)
  ) as ClaudeResponse

  return responseBody.content[0].text
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
  const responseBody = JSON.parse(
    new TextDecoder().decode(response.body)
  ) as ClaudeResponse

  return responseBody.content[0].text
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
