import { getBotToken } from '../config'

/**
 * Telegram API integration utilities
 */

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
