import $ from '@core/constants'
import type { UserFromGetMe } from 'grammy/types'

// Environment configuration
export const getBotToken = () => process.env[$.env.TELEGRAM_BOT_TOKEN] || ''
export const getMiniAppUrl = () => process.env[$.env.MINI_APP_URL] || 'https://t.me/FractiBot/app'

// Bot info to avoid init() call in Lambda cold starts
export const BOT_INFO: UserFromGetMe = {
  id: 8365279809,
  is_bot: true,
  first_name: 'Fracti',
  username: 'fractibot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: true,
  can_connect_to_business: false,
  has_main_web_app: true,
}
