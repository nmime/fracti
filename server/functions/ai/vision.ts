import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import { invokeClaudeVision, VISION_SYSTEM_PROMPT } from '../../lib/bedrock'
import { json, error } from '../../lib/response'

interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

interface ParsedReceipt {
  items: ReceiptItem[]
  total: number
  tax?: number
  currency: string
  merchant?: string
  date?: string
  confidence: number
}

// Max image size (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { image, mediaType = 'image/jpeg' } = body

    if (!image || typeof image !== 'string') {
      return error('Missing or invalid image field (expected base64 string)')
    }

    // Validate image size
    const imageBuffer = Buffer.from(image, 'base64')
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return error(`Image too large (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`)
    }

    // Validate media type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(mediaType)) {
      return error(`Invalid media type. Allowed: ${allowedTypes.join(', ')}`)
    }

    console.log('Processing receipt image, size:', imageBuffer.length)

    // Call Claude Vision to analyze the receipt
    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      image,
      mediaType
    )

    console.log('Claude Vision response:', response)

    // Parse the JSON response
    let parsed: ParsedReceipt

    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError)
      return error('Failed to parse receipt data')
    }

    // Validate and normalize the response
    if (!Array.isArray(parsed.items)) {
      parsed.items = []
    }

    // Ensure items have valid structure
    const validItems = parsed.items.filter(
      (item) =>
        typeof item.name === 'string' &&
        typeof item.price === 'number' &&
        item.price >= 0
    )

    // Calculate total if not provided
    const calculatedTotal = validItems.reduce(
      (sum, item) => sum + item.price * (item.quantity || 1),
      0
    )

    const result: ParsedReceipt = {
      items: validItems.map((item) => ({
        name: item.name,
        quantity: item.quantity || 1,
        price: Math.round(item.price * 100) / 100,
      })),
      total:
        typeof parsed.total === 'number'
          ? Math.round(parsed.total * 100) / 100
          : Math.round(calculatedTotal * 100) / 100,
      tax:
        typeof parsed.tax === 'number'
          ? Math.round(parsed.tax * 100) / 100
          : undefined,
      currency: parsed.currency || 'USD',
      merchant: parsed.merchant || undefined,
      date: parsed.date || undefined,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    }

    return json(result)
  } catch (err) {
    console.error('Vision handler error:', err)

    if (err instanceof Error && err.name === 'AccessDeniedException') {
      return error('AI service not configured', 503)
    }

    return error('Failed to process receipt image', 500)
  }
}
