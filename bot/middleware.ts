import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import $ from '@core/constants'

const s3Client = new S3Client({
  region: process.env[$.env.AWS_REGION] || $.aws.region,
})

const getBucketName = () => process.env[$.env.S3_BUCKET_NAME] || ''

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    })
  )

  return key
}

export async function uploadAvatar(
  telegramId: number,
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<string> {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg'
  const key = `${$.artifacts.s3.avatars}/${telegramId}.${extension}`

  return uploadToS3(key, imageBuffer, mimeType)
}

export function getS3Url(key: string): string {
  const bucketName = getBucketName()
  const region = process.env[$.env.AWS_REGION] || $.aws.region
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

export function transformAvatarUrl(avatarUrl: string | undefined | null): string | undefined {
  if (!avatarUrl) return undefined

  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }

  return getS3Url(avatarUrl)
}

// Telegram API utilities
const getBotToken = () => process.env[$.env.TELEGRAM_BOT_TOKEN] || ''

export async function getFileUrl(fileId: string): Promise<string | null> {
  const botToken = getBotToken()
  if (!botToken) return null

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      }
    )

    if (!response.ok) return null

    const data = await response.json() as { ok: boolean; result?: { file_path?: string } }
    if (!data.ok || !data.result?.file_path) return null

    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`
  } catch {
    return null
  }
}

export async function downloadFile(fileId: string): Promise<Buffer | null> {
  const fileUrl = await getFileUrl(fileId)
  if (!fileUrl) return null

  try {
    const response = await fetch(fileUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

export async function getUserProfilePhoto(userId: number): Promise<string | null> {
  const botToken = getBotToken()
  if (!botToken) return null

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, limit: 1 }),
      }
    )

    if (!response.ok) return null

    const data = await response.json() as { ok: boolean; result?: { photos?: Array<Array<{ file_id: string }>> } }
    if (!data.ok || !data.result?.photos?.length) return null

    const photo = data.result.photos[0]
    if (!photo?.length) return null

    const largestPhoto = photo[photo.length - 1]
    return largestPhoto?.file_id ?? null
  } catch {
    return null
  }
}

export async function downloadUserProfilePhoto(
  userId: number
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const fileId = await getUserProfilePhoto(userId)
  if (!fileId) return null

  const buffer = await downloadFile(fileId)
  if (!buffer) return null

  return { buffer, mimeType: 'image/jpeg' }
}
