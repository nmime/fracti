import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config'
import { logger } from '../utils/logger'

const s3Client = new S3Client({
  region: config.AWS_REGION,
})

const BUCKET_NAME = config.S3_BUCKET_NAME

/**
 * Upload a file to S3
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
      CacheControl: 'max-age=31536000',
    })
  )

  logger.info('Uploaded file to S3', { key, contentType, size: body.length })

  return key
}

/**
 * Upload user avatar to S3
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
 */
export function getS3Url(key: string): string {
  return `https://${BUCKET_NAME}.s3.${config.AWS_REGION}.amazonaws.com/${key}`
}

/**
 * Get a presigned URL for private S3 objects
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
 */
export function transformAvatarUrl(avatarUrl: string | undefined | null): string | undefined {
  if (!avatarUrl) return undefined

  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }

  return getS3Url(avatarUrl)
}
