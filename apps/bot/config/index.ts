import $ from '@libs/constants';
import type { UserFromGetMe } from 'grammy/types';

/**
 * Bot configuration module
 * Centralizes all environment and bot configuration
 */

// Environment configuration
export const getBotToken = () => process.env[$.env.TELEGRAM_BOT_TOKEN] || '';

// URL configuration
// MINI_APP_URL: t.me deeplink for Mini App (e.g., https://t.me/FractiBot/app)
export const getMiniAppUrl = () => process.env[$.env.MINI_APP_URL] || 'https://t.me/FractiBot/app';

// APP_URL: CloudFront/domain URL for webApp buttons in private chats (e.g., https://fracti.app)
export const getAppUrl = () => process.env[$.env.APP_URL] || '';

// Check if APP_URL is configured (CloudFront URL for webApp buttons)
export const hasAppUrl = () => !!getAppUrl();

// AWS configuration
export const getAwsRegion = () => process.env[$.env.AWS_REGION] || $.aws.region;
export const getS3BucketName = () => process.env[$.env.S3_BUCKET_NAME] || '';
export const getBedrockModelId = () => process.env[$.env.BEDROCK_MODEL_ID] || $.bedrock.model;

// Bot info for Lambda cold starts (avoids init() call)
// NOTE: can_read_all_group_messages is controlled by BotFather Privacy Mode setting
// When false (Privacy Mode ON), bot only receives in groups:
// - Commands with @username (e.g., /start@fractibot)
// - Replies to bot messages
// - Messages that @mention the bot
// To disable Privacy Mode: BotFather → /mybots → Bot Settings → Group Privacy → Turn off
export const BOT_INFO: UserFromGetMe = {
  id: 8365279809,
  is_bot: true,
  first_name: 'Fracti',
  username: 'fractibot',
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: true,
};
