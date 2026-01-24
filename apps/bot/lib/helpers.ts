import type { Chat, User } from 'grammy/types'
import { getUser, upsertUser } from '@core/db'
import { downloadUserProfilePhoto, uploadAvatar } from '../middleware'

export function isGroupChat(chat: Chat): chat is Chat.GroupChat | Chat.SupergroupChat {
  return chat.type === 'group' || chat.type === 'supergroup'
}

export function getChatTitle(chat: Chat | undefined): string {
  if (!chat) return 'Group'
  if (isGroupChat(chat)) {
    return chat.title
  }
  return 'Group'
}

export async function registerUserWithAvatar(groupId: string, user: User): Promise<void> {
  const telegramId = user.id
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')

  const existingUser = await getUser(groupId, telegramId)
  let avatarUrl = existingUser?.avatarUrl

  if (!avatarUrl) {
    try {
      const photo = await downloadUserProfilePhoto(telegramId)
      if (photo) {
        avatarUrl = await uploadAvatar(telegramId, photo.buffer, photo.mimeType)
      }
    } catch {
      // Continue without avatar
    }
  }

  await upsertUser(groupId, {
    id: String(telegramId),
    telegramId,
    name,
    username: user.username,
    avatarUrl,
  })
}
