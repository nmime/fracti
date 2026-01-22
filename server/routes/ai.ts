import { Hono } from 'hono'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from '../lib/bedrock'
import { authMiddleware, requireAuth } from '../middleware/auth'

export const aiRoutes = new Hono()

// Apply auth middleware
aiRoutes.use('*', authMiddleware)

// POST /api/ai/parse - Parse expense text with AI
aiRoutes.post('/parse', requireAuth, async (c) => {
  const body = await c.req.json()
  const { text, context } = body

  if (!text) {
    return c.json({ error: 'Bad Request', message: 'Text is required' }, 400)
  }

  try {
    // Build prompt with optional context
    let prompt = text
    if (context?.members) {
      prompt += `\n\nGroup members: ${context.members.join(', ')}`
    }

    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, prompt)

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return c.json({
        success: false,
        error: 'Could not parse expense from text',
        raw: response,
      })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return c.json({
      success: true,
      expense: {
        payer: parsed.payer || null,
        amount: parsed.amount || 0,
        currency: parsed.currency || 'TON',
        description: parsed.description || '',
        beneficiaries: parsed.beneficiaries || [],
        splitType: parsed.split_type || 'equal',
        confidence: parsed.confidence || 0,
      },
      raw: response,
    })
  } catch (error) {
    console.error('AI parse error:', error)
    return c.json(
      { error: 'AI Error', message: 'Failed to parse expense text' },
      500
    )
  }
})

// POST /api/ai/vision - Parse receipt image with AI
aiRoutes.post('/vision', requireAuth, async (c) => {
  const body = await c.req.json()
  const { image, mimeType } = body

  if (!image) {
    return c.json({ error: 'Bad Request', message: 'Image (base64) is required' }, 400)
  }

  try {
    const response = await invokeClaudeVision(
      VISION_SYSTEM_PROMPT,
      image,
      mimeType || 'image/jpeg'
    )

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return c.json({
        success: false,
        error: 'Could not parse receipt from image',
        raw: response,
      })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return c.json({
      success: true,
      receipt: {
        merchant: parsed.merchant || null,
        date: parsed.date || null,
        items: parsed.items || [],
        subtotal: parsed.subtotal || 0,
        tax: parsed.tax || 0,
        total: parsed.total || 0,
        currency: parsed.currency || 'USD',
        confidence: parsed.confidence || 0,
      },
      raw: response,
    })
  } catch (error) {
    console.error('AI vision error:', error)
    return c.json(
      { error: 'AI Error', message: 'Failed to parse receipt image' },
      500
    )
  }
})
