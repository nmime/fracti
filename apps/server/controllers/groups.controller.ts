import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { groupsService } from '../services/groups.service'
import type { TelegramUser } from '../integrations/telegram'
import { transformAvatarUrl } from '../integrations/s3'

export class GroupsController {
  async list(c: Context, user: TelegramUser) {
    const groups = await groupsService.getGroupsByUser(user.id)

    return c.json({
      success: true,
      data: groups.map((g) => ({
        id: g.id,
        chatId: g.chatId,
        title: g.title,
        currency: g.currency,
        createdAt: g.createdAt,
        memberCount: g.memberCount,
      })),
    })
  }

  async getById(c: Context, groupId: string) {
    const group = await groupsService.getGroupWithMembers(groupId)

    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    return c.json({
      success: true,
      data: {
        ...group,
        members: group.members.map((m) => ({
          id: m.id,
          name: m.name,
          username: m.username,
          wallet: m.wallet,
          avatarUrl: transformAvatarUrl(m.avatarUrl),
        })),
      },
    })
  }

  async create(c: Context, user: TelegramUser, title: string, chatId: string) {
    const group = await groupsService.createGroup(title, chatId, user)

    return c.json({ success: true, data: group }, 201)
  }

  async join(c: Context, user: TelegramUser, groupId: string, wallet?: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    await groupsService.joinGroup(groupId, user, wallet)

    return c.json({ success: true, message: 'Joined group successfully' })
  }

  async updateWallet(c: Context, user: TelegramUser, groupId: string, wallet: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    await groupsService.updateWallet(groupId, user, wallet)

    return c.json({ success: true, data: { wallet } })
  }
}

export const groupsController = new GroupsController()
