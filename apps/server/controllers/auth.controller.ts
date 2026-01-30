import { validateInitData, validateWidgetData, type TelegramUser } from '../integrations/telegram';
import { generateToken } from '../utils/jwt';
import type { Context } from 'hono';

function formatUserResponse(user: TelegramUser, authMethod: string, token: string) {
  return {
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
      languageCode: user.language_code,
      isPremium: user.is_premium,
    },
    token,
    authMethod,
    authenticated: true,
  };
}

export class AuthController {
  /**
   * Authenticate via Telegram Login Widget and issue JWT
   */
  async validateWidgetData(c: Context, data: Record<string, string | number>) {
    const user = validateWidgetData(data);

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Invalid widget data',
          message: 'Widget authentication failed. Please try logging in again.',
        },
        401,
      );
    }

    const token = generateToken(user);

    return c.json({
      success: true,
      data: formatUserResponse(user, 'widget', token),
    });
  }

  /**
   * Authenticate via Mini App init data and issue JWT
   */
  async validateInitData(c: Context, initData: string) {
    const user = validateInitData(initData);

    if (!user) {
      return c.json(
        {
          success: false,
          error: 'Invalid init data',
          message: 'Mini App authentication failed. Please reopen the app from Telegram.',
        },
        401,
      );
    }

    const token = generateToken(user);

    return c.json({
      success: true,
      data: formatUserResponse(user, 'init_data', token),
    });
  }
}

export const authController = new AuthController();
