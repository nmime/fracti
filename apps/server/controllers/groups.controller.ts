import { HTTPException } from 'hono/http-exception';
import { transformAvatarUrl } from '../integrations/s3';
import { groupsService } from '../services';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';

export class GroupsController {
  async list(c: Context, user: TelegramUser) {
    const groups = await groupsService.getGroupsByUser(user.id);

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
    });
  }

  async getById(c: Context, groupId: string) {
    const group = await groupsService.getGroupWithMembers(groupId);

    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
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
    });
  }

  async create(c: Context, user: TelegramUser, title: string, chatId: string) {
    const group = await groupsService.createGroup(title, chatId, user);

    return c.json({ success: true, data: group }, 201);
  }

  async join(c: Context, user: TelegramUser, groupId: string, wallet?: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    await groupsService.joinGroup(groupId, user, wallet);

    return c.json({ success: true, message: 'Joined group successfully' });
  }

  async updateWallet(c: Context, user: TelegramUser, groupId: string, wallet: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    await groupsService.updateWallet(groupId, user, wallet);

    return c.json({ success: true, data: { wallet } });
  }

  async getActivity(c: Context, _user: TelegramUser, groupId: string, limit: number, cursor?: string) {
    const result = await groupsService.getGroupActivity(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    });

    return c.json({
      success: true,
      data: result.items,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    });
  }
}

export const groupsController = new GroupsController();
