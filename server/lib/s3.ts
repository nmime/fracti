import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from './config'
import { logger } from './logger'

const s3Client = new S3Client({
  region: config.AWS_REGION,
})

const BUCKET_NAME = config.S3_BUCKET_NAME

/**
 * Upload a file to S3
 * @param key - The S3 object key (path)
 * @param body - The file content as Buffer
 * @param contentType - MIME type of the file
 * @returns The relative S3 key (not full URL)
 */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year cache for avatars
    })
  )

  logger.info('Uploaded file to S3', { key, contentType, size: body.length })

  // Return relative key, not full URL
  return key
}

/**
 * Upload user avatar to S3
 * @param telegramId - User's Telegram ID
 * @param imageBuffer - Avatar image as Buffer
 * @param mimeType - Image MIME type (default: image/jpeg)
 * @returns Relative S3 key for the avatar
 */
export async function uploadAvatar(
  telegramId: number,
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<string> {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg'
  const key = `avatars/${telegramId}.${extension}`

  return uploadToS3(key, imageBuffer, mimeType)
}

/**
 * Get the full S3 URL for a relative key
 * @param key - Relative S3 key
 * @returns Full S3 URL
 */
export function getS3Url(key: string): string {
  return `https://${BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
}

/**
 * Get a presigned URL for private S3 objects (if needed)
 * @param key - S3 object key
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Transform avatar URL from relative to full URL
 * @param avatarUrl - Relative avatar URL or null
 * @returns Full S3 URL or undefined
 */
export function transformAvatarUrl(avatarUrl: string | undefined | null): string | undefined {
  if (!avatarUrl) return undefined

  // If already a full URL, return as-is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }

  // Transform relative key to full S3 URL
  return getS3Url(avatarUrl)
}
