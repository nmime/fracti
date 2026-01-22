import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'

import type { Env } from '../lib/factory'
import {
  invokeClaudeText,
  invokeClaudeVision,
  PARSER_SYSTEM_PROMPT,
  VISION_SYSTEM_PROMPT,
} from '../lib/bedrock'
import { authMiddleware, requireAuth } from '../middleware/auth'
import { parseTextSchema, parseVisionSchema } from '../lib/schemas'

export const aiRoutes = new Hono<Env>()

// Apply auth middleware
aiRoutes.use('*', authMiddleware)

// POST /api/ai/parse - Parse expense text with AI
aiRoutes.post(
  '/parse',
  requireAuth,
  zValidator('json', parseTextSchema),
  async (c) => {
    const { text, context } = c.req.valid('json')

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
        data: {
          expense: {
            payer: parsed.payer || null,
            amount: parsed.amount || 0,
            currency: parsed.currency || 'TON',
            description: parsed.description || '',
            beneficiaries: parsed.beneficiaries || [],
            splitType: parsed.split_type || 'equal',
            confidence: parsed.confidence || 0,
          },
        },
        raw: response,
      })
    } catch (error) {
      console.error('AI parse error:', error)
      throw new HTTPException(500, {
        message: 'Failed to parse expense text',
        cause: error,
      })
    }
  }
)

// POST /api/ai/vision - Parse receipt image with AI
aiRoutes.post(
  '/vision',
  requireAuth,
  zValidator('json', parseVisionSchema),
  async (c) => {
    const { image, mimeType } = c.req.valid('json')

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
        data: {
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
        },
        raw: response,
      })
    } catch (error) {
      console.error('AI vision error:', error)
      throw new HTTPException(500, {
        message: 'Failed to parse receipt image',
        cause: error,
      })
    }
  }
)
