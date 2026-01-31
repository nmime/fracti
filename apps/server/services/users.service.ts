import {
  getGroup,
  getGroupsByUser,
  getExpensesPaidByUser,
  getExpensesOwedByUser,
  getSettlementsByUser,
  getAllExpenses,
  getAllSettlements,
} from '@libs/db';
import type { PaginationOptions, UserExpenseSummary } from '@libs/types';

export interface UserGroupInfo {
  id: string;
  title: string;
  chatId: string;
  memberCount: number;
  currency?: string;
  joinedAt: string;
  balance: number;
  expenseCount: number;
}

export interface UserExpenseInfo {
  id: string;
  groupId: string;
  groupTitle: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  description: string;
  yourShare: number;
  createdAt: string;
}

export interface UserSettlementInfo {
  id: string;
  groupId: string;
  groupTitle: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
}

class UsersService {
  async getUserSummary(telegramId: number): Promise<UserExpenseSummary> {
    const memberships = await getGroupsByUser(telegramId);
    const groupCount = memberships.length;

    // Fetch all expenses and settlements for the user
    let totalPaid = 0;
    let totalOwed = 0;
    let expensesPaidCount = 0;
    let expensesOwedCount = 0;
    let settlementsCount = 0;
    let settledAmount = 0;

    // Get expenses paid by user
    let lastPaidKey: Record<string, unknown> | undefined;
    do {
      const result = await getExpensesPaidByUser(telegramId, { lastKey: lastPaidKey });
      totalPaid += result.items.reduce((sum, e) => sum + e.amount, 0);
      expensesPaidCount += result.items.length;
      lastPaidKey = result.lastKey;
    } while (lastPaidKey);

    // Get expenses owed by user
    let lastOwedKey: Record<string, unknown> | undefined;
    do {
      const result = await getExpensesOwedByUser(telegramId, { lastKey: lastOwedKey });
      totalOwed += result.items.reduce((sum, e) => sum + e.amount, 0);
      expensesOwedCount += result.items.length;
      lastOwedKey = result.lastKey;
    } while (lastOwedKey);

    // Get settlements by user
    let lastSettlementKey: Record<string, unknown> | undefined;
    do {
      const result = await getSettlementsByUser(telegramId, { lastKey: lastSettlementKey });
      settlementsCount += result.items.length;
      settledAmount += result.items.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.amount, 0);
      lastSettlementKey = result.lastKey;
    } while (lastSettlementKey);

    return {
      totalPaid,
      totalOwed,
      netBalance: totalPaid - totalOwed + settledAmount,
      expensesPaidCount,
      expensesOwedCount,
      settlementsCount,
      groupCount,
    };
  }

  async getUserGroups(telegramId: number): Promise<UserGroupInfo[]> {
    const memberships = await getGroupsByUser(telegramId);
    console.log('[getUserGroups] telegramId:', telegramId, 'memberships:', JSON.stringify(memberships));
    const groups: UserGroupInfo[] = [];

    for (const membership of memberships) {
      const groupId = membership.GSI1SK?.replace('GROUP#', '');
      if (!groupId) continue;

      const group = await getGroup(groupId);
      if (!group) continue;

      // Calculate balance and expense count for this group
      const [expenses, settlements] = await Promise.all([
        getAllExpenses(groupId),
        getAllSettlements(groupId),
      ]);

      let balance = 0;
      // Use member UUID for matching - this is the ID used in expenses/settlements
      const memberId = membership.id;
      // Also keep telegram ID string for backward compatibility with old data
      const telegramIdStr = String(telegramId);

      for (const expense of expenses) {
        // Check both member UUID and legacy telegram ID string
        const isPayer = expense.payerId === memberId || expense.payerId === telegramIdStr;
        if (isPayer) {
          const payerSplit = expense.splits.find((s) => s.userId === memberId || s.userId === telegramIdStr)?.amount || 0;
          balance += expense.amount - payerSplit;
        } else {
          const split = expense.splits.find((s) => s.userId === memberId || s.userId === telegramIdStr);
          if (split) {
            balance -= split.amount;
          }
        }
      }

      for (const settlement of settlements) {
        if (settlement.status === 'completed') {
          // Check both member UUID and legacy telegram ID string
          const isFromUser = settlement.fromUserId === memberId || settlement.fromUserId === telegramIdStr;
          const isToUser = settlement.toUserId === memberId || settlement.toUserId === telegramIdStr;
          if (isFromUser) {
            balance += settlement.amount;
          } else if (isToUser) {
            balance -= settlement.amount;
          }
        }
      }

      groups.push({
        id: groupId,
        title: group.title,
        chatId: group.chatId,
        memberCount: group.memberCount || 0,
        currency: group.currency,
        joinedAt: membership.joinedAt || group.createdAt,
        balance: Math.round(balance * 100) / 100,
        expenseCount: expenses.length,
      });
    }

    return groups;
  }

  async getUserExpenses(telegramId: number, options?: PaginationOptions): Promise<{ items: UserExpenseInfo[]; hasMore: boolean; lastKey?: Record<string, unknown> }> {
    const result = await getExpensesPaidByUser(telegramId, options);

    // Build a map of groupId -> memberId for this user
    const memberships = await getGroupsByUser(telegramId);
    const groupToMemberId = new Map<string, string>();
    for (const membership of memberships) {
      const groupId = membership.GSI1SK?.replace('GROUP#', '');
      if (groupId) {
        groupToMemberId.set(groupId, membership.id);
      }
    }

    // Enrich expenses with group title and yourShare
    const enrichedItems: UserExpenseInfo[] = [];

    for (const expense of result.items) {
      // Get group title
      const group = await getGroup(expense.groupId);
      const groupTitle = group?.title || 'Unknown Group';

      // Get this user's member UUID for this group
      const memberId = groupToMemberId.get(expense.groupId);
      // Also check telegram ID string for backward compatibility with old data
      const telegramIdStr = String(telegramId);

      // Calculate yourShare - the amount this user owes for this expense
      const userSplit = expense.splits.find((s) => s.userId === memberId || s.userId === telegramIdStr);
      const yourShare = userSplit?.amount || 0;

      enrichedItems.push({
        id: expense.id,
        groupId: expense.groupId,
        groupTitle,
        payerId: expense.payerId,
        payerName: expense.payerName,
        amount: expense.amount,
        currency: expense.currency || 'USDT',
        description: expense.description,
        yourShare,
        createdAt: expense.createdAt,
      });
    }

    return {
      items: enrichedItems,
      hasMore: result.hasMore,
      lastKey: result.lastKey,
    };
  }

  async getUserSettlements(telegramId: number, options?: PaginationOptions): Promise<{ items: UserSettlementInfo[]; hasMore: boolean; lastKey?: Record<string, unknown> }> {
    const result = await getSettlementsByUser(telegramId, options);

    // Enrich settlements with group title
    const enrichedItems: UserSettlementInfo[] = [];

    for (const settlement of result.items) {
      const group = await getGroup(settlement.groupId);
      const groupTitle = group?.title || 'Unknown Group';

      enrichedItems.push({
        id: settlement.id,
        groupId: settlement.groupId,
        groupTitle,
        fromUserId: settlement.fromUserId,
        fromUserName: settlement.fromUserName,
        toUserId: settlement.toUserId,
        toUserName: settlement.toUserName,
        amount: settlement.amount,
        currency: settlement.currency || 'USDT',
        status: settlement.status,
        txHash: settlement.txHash,
        createdAt: settlement.createdAt,
      });
    }

    return {
      items: enrichedItems,
      hasMore: result.hasMore,
      lastKey: result.lastKey,
    };
  }
}

export const usersService = new UsersService();
