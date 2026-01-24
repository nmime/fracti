import type { Context } from 'hono'
import { aiService } from '../services/ai.service'

export class AIController {
  async parseText(c: Context, text: string) {
    const result = await aiService.parseExpenseText(text)

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error,
        },
        400
      )
    }

    return c.json({
      success: true,
      data: {
        ...result.data,
        fallback: result.fallback,
      },
    })
  }

  async parseVision(c: Context, image: string, mimeType: string) {
    const result = await aiService.parseReceiptImage(image, mimeType)

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error,
        },
        400
      )
    }

    return c.json({
      success: true,
      data: result.data,
    })
  }
}

export const aiController = new AIController()
