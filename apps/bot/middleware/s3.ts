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
