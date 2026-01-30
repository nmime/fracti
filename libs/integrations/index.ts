/**
 * @libs/integrations - Shared integration utilities
 */

// S3
export type { S3Config, S3Logger } from './s3';
export { initS3, uploadToS3, uploadAvatar, getS3Url, getPresignedUrl, transformAvatarUrl } from './s3';

// Telegram
export type { TelegramLogger } from './telegram';
export { getFileUrl, downloadFile, getUserProfilePhoto, downloadUserProfilePhoto } from './telegram';
