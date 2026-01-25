import $ from '@core/constants'
import type { UserFromGetMe } from 'grammy/types'

/**
 * Bot configuration module
 * Centralizes all environment and bot configuration
 */

// Environment configuration
export const getBotToken = () => process.env[$.env.TELEGRAM_BOT_TOKEN] || ''

// Mini App URL configuration
export const getMiniAppUrl = () => process.env[$.env.MINI_APP_URL] || 'https://t.me/FractiBot/app'

// Check if URL is a proper webApp URL (not a t.me deeplink)
export const isWebAppUrl = (url: string = getMiniAppUrl()) => {
  return !url.includes('t.me/')
}

// AWS configuration
export const getAwsRegion = () => process.env[$.env.AWS_REGION] || $.aws.region
export const getS3BucketName = () => process.env[$.env.S3_BUCKET_NAME] || ''
export const getBedrockModelId = () => process.env[$.env.BEDROCK_MODEL_ID] || $.bedrock.model

// Bot info for Lambda cold starts (avoids init() call)
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
