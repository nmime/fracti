import type { Context } from 'hono'
import { validateInitData, validateWidgetData } from '../integrations/telegram'

export class AuthController {
  async validateWidgetData(c: Context, data: Record<string, string>) {
    const user = validateWidgetData(data)

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Invalid widget data',
        },
        401
      )
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        photoUrl: user.photo_url,
      },
    })
  }

  async validateInitData(c: Context, initData: string) {
    const user = validateInitData(initData)

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Invalid init data',
        },
        401
      )
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        languageCode: user.language_code,
        isPremium: user.is_premium,
        photoUrl: user.photo_url,
      },
    })
  }
}

export const authController = new AuthController()
