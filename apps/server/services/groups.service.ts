import { randomUUID } from 'crypto';
import {
  getGroup,
  createGroup,
  getGroupMembers,
  getGroupsByUser,
  upsertUser,
  getExpenses,
  getSettlements,
} from '@libs/db';
import { transformAvatarUrl } from '../integrations/s3';
import type { TelegramUser } from '../integrations/telegram';
import type { GroupRecord, MemberRecord, GroupActivityItem, PaginationOptions, PaginatedResult } from '@libs/types';

export interface GroupWithMembers extends GroupRecord {
  members: {
    id: string;
    telegramId: number;
    name: string;
    username?: string;
    wallet?: string;
    avatarUrl?: string;
  }[];
}

class GroupsService {
  async getGroupById(groupId: string): Promise<GroupRecord | null> {
    return getGroup(groupId);
  }

  async getGroupWithMembers(groupId: string): Promise<GroupWithMembers | null> {
    const group = await getGroup(groupId);
    if (!group) return null;

    const members = await getGroupMembers(groupId);

    return {
      ...group,
      memberCount: members.length,
      members: members.map((m) => ({
        id: m.id,
        telegramId: m.telegramId,
        name: m.name,
        username: m.username,
        wallet: m.wallet,
        avatarUrl: transformAvatarUrl(m.avatarUrl),
      })),
    };
  }

  async getGroupsByUser(telegramId: number): Promise<GroupRecord[]> {
    const memberships = await getGroupsByUser(telegramId);

    const groupIds = memberships.map((m) => m.GSI1SK?.replace('GROUP#', '')).filter(Boolean) as string[];

    const groups = await Promise.all(groupIds.map((id) => getGroup(id)));

    return groups.filter(Boolean) as GroupRecord[];
  }

  async createGroup(title: string, chatId: string, creator: TelegramUser): Promise<GroupRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const group = await createGroup({
      id,
      chatId,
      title,
      createdAt: now,
      memberCount: 1,
    });

    // Add creator as first member
    await upsertUser(id, {
      telegramId: creator.id,
      name: [creator.first_name, creator.last_name].filter(Boolean).join(' '),
      username: creator.username,
    });

    return group;
  }

  async joinGroup(groupId: string, user: TelegramUser, wallet?: string): Promise<MemberRecord> {
    return upsertUser(groupId, {
      telegramId: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      username: user.username,
      wallet,
    });
  }

  async updateWallet(groupId: string, user: TelegramUser, wallet: string): Promise<void> {
    await upsertUser(groupId, {
      telegramId: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      username: user.username,
      wallet,
    });
  }

  async getGroupMembers(groupId: string): Promise<MemberRecord[]> {
    return getGroupMembers(groupId);
  }

  async isMember(groupId: string, telegramId: number): Promise<boolean> {
    const members = await getGroupMembers(groupId);

    // Debug logging for membership check
    console.log('[isMember] Checking membership:', {
      groupId,
      telegramId,
      telegramIdType: typeof telegramId,
      membersCount: members.length,
      memberTelegramIds: members.map((m) => ({ id: m.id, telegramId: m.telegramId, type: typeof m.telegramId })),
    });

    // Use telegramId for membership check - this is the Telegram user ID
    const isMember = members.some((m) => m.telegramId === telegramId);
    console.log('[isMember] Result:', isMember);

    return isMember;
  }

  async getGroupActivity(groupId: string, options?: PaginationOptions): Promise<PaginatedResult<GroupActivityItem>> {
    const limit = options?.limit || 20;
    const fetchLimit = limit * 2;

    // Fetch expenses and settlements from the group
    const [expensesResult, settlementsResult] = await Promise.all([
      getExpenses(groupId, { limit: fetchLimit }),
      getSettlements(groupId, { limit: fetchLimit }),
    ]);

    // Map expenses to activity items
    const expenseActivities: GroupActivityItem[] = expensesResult.items.map((e) => ({
      type: 'expense' as const,
      id: e.id,
      userId: e.payerId,
      userName: e.payerName,
      amount: e.amount,
      description: e.description,
      createdAt: e.createdAt,
    }));

    // Map settlements to activity items
    const settlementActivities: GroupActivityItem[] = settlementsResult.items.map((s) => ({
      type: 'settlement' as const,
      id: s.id,
      userId: s.fromUserId,
      userName: s.fromUserName,
      amount: s.amount,
      otherPartyId: s.toUserId,
      otherPartyName: s.toUserName,
      createdAt: s.createdAt,
    }));

    // Combine and sort by createdAt descending
    const allActivities = [...expenseActivities, ...settlementActivities].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    // Apply cursor filtering if provided
    let filteredActivities = allActivities;
    if (options?.lastKey?.cursor) {
      const cursorTimestamp = options.lastKey.cursor as string;
      filteredActivities = allActivities.filter((a) => a.createdAt < cursorTimestamp);
    }

    // Apply limit
    const items = filteredActivities.slice(0, limit);
    const hasMore = filteredActivities.length > limit;

    // Create cursor for pagination
    const lastKey = hasMore && items.length > 0 ? { cursor: items[items.length - 1].createdAt } : undefined;

    return {
      items,
      lastKey,
      hasMore,
    };
  }
}

export const groupsService = new GroupsService();
