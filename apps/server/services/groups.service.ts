import { randomUUID } from 'crypto'
import { groupsRepository } from '../repositories/groups.repository'
import { membersRepository } from '../repositories/members.repository'
import type { GroupRecord, MemberRecord } from '../types/db.types'
import type { TelegramUser } from '../integrations/telegram'
import { transformAvatarUrl } from '../integrations/s3'

export interface GroupWithMembers extends GroupRecord {
  members: Array<{
    id: string
    name: string
    username?: string
    wallet?: string
    avatarUrl?: string
  }>
}

class GroupsService {
  async getGroupById(groupId: string): Promise<GroupRecord | null> {
    return groupsRepository.findById(groupId)
  }

  async getGroupWithMembers(groupId: string): Promise<GroupWithMembers | null> {
    const group = await groupsRepository.findById(groupId)
    if (!group) return null

    const members = await membersRepository.findByGroup(groupId)

    return {
      ...group,
      memberCount: members.length,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        username: m.username,
        wallet: m.wallet,
        avatarUrl: transformAvatarUrl(m.avatarUrl),
      })),
    }
  }

  async getGroupsByUser(telegramId: number): Promise<GroupRecord[]> {
    const memberships = await membersRepository.findGroupsByUser(telegramId)

    const groupIds = memberships.items
      .map((m) => m.GSI1SK?.replace('GROUP#', ''))
      .filter(Boolean) as string[]

    const groups = await Promise.all(groupIds.map((id) => groupsRepository.findById(id)))

    return groups.filter(Boolean) as GroupRecord[]
  }

  async createGroup(
    title: string,
    chatId: string,
    creator: TelegramUser
  ): Promise<GroupRecord> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const group = await groupsRepository.create({
      id,
      chatId,
      title,
      createdAt: now,
      memberCount: 1,
    })

    // Add creator as first member
    await membersRepository.upsert(id, {
      id: String(creator.id),
      telegramId: creator.id,
      name: [creator.first_name, creator.last_name].filter(Boolean).join(' '),
      username: creator.username,
    })

    return group
  }

  async joinGroup(
    groupId: string,
    user: TelegramUser,
    wallet?: string
  ): Promise<MemberRecord> {
    return membersRepository.upsert(groupId, {
      id: String(user.id),
      telegramId: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      username: user.username,
      wallet,
    })
  }

  async updateWallet(
    groupId: string,
    user: TelegramUser,
    wallet: string
  ): Promise<void> {
    await membersRepository.upsert(groupId, {
      id: String(user.id),
      telegramId: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      username: user.username,
      wallet,
    })
  }

  async getGroupMembers(groupId: string): Promise<MemberRecord[]> {
    return membersRepository.findByGroup(groupId)
  }

  async isMember(groupId: string, telegramId: number): Promise<boolean> {
    const members = await membersRepository.findByGroup(groupId)
    return members.some((m) => m.id === String(telegramId))
  }
}

export const groupsService = new GroupsService()
