import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * AWS S3 integration utilities
 */

export interface S3Config {
  region: string;
  bucketName: string;
}

export interface S3Logger {
  info(message: string, context?: Record<string, unknown>): void;
}

let s3Client: S3Client | null = null;
let currentConfig: S3Config | null = null;
let currentLogger: S3Logger | null = null;

export function initS3(config: S3Config, logger?: S3Logger): void {
  currentConfig = config;
  currentLogger = logger ?? null;
  s3Client = new S3Client({ region: config.region });
}

function getClient(): S3Client {
  if (!s3Client || !currentConfig) {
    throw new Error('S3 client not initialized. Call initS3() first.');
  }

  return s3Client;
}

function getConfig(): S3Config {
  if (!currentConfig) {
    throw new Error('S3 client not initialized. Call initS3() first.');
  }

  return currentConfig;
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getConfig().bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    }),
  );

  currentLogger?.info('Uploaded file to S3', { key, contentType, size: body.length });

  return key;
}

/**
 * Upload user avatar to S3
 */
export async function uploadAvatar(
  telegramId: number,
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
  avatarPath = 'avatars',
): Promise<string> {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `${avatarPath}/${telegramId}.${extension}`;

  return uploadToS3(key, imageBuffer, mimeType);
}

/**
 * Get the full S3 URL for a relative key
 */
export function getS3Url(key: string): string {
  const config = getConfig();

  return `https://${config.bucketName}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Get a presigned URL for private S3 objects
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getConfig().bucketName,
    Key: key,
  });

  return getSignedUrl(getClient(), command, { expiresIn });
}

/**
 * Transform avatar URL from relative to full URL
 */
export function transformAvatarUrl(avatarUrl: string | undefined | null): string | undefined {
  if (!avatarUrl) return undefined;

  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  return getS3Url(avatarUrl);
}
