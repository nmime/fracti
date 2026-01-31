import { getUserLanguage, setUserLanguage, type SupportedLanguage } from '@libs/db';
import { usersService } from '../services';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';

export class UsersController {
  async getProfile(c: Context, user: TelegramUser) {
    const summary = await usersService.getUserSummary(user.id);

    return c.json({
      success: true,
      data: {
        id: String(user.id),
        name: [user.first_name, user.last_name].filter(Boolean).join(' '),
        username: user.username,
        summary,
      },
    });
  }

  async getGroups(c: Context, user: TelegramUser) {
    const groups = await usersService.getUserGroups(user.id);

    return c.json({
      success: true,
      data: groups,
    });
  }

  async getExpenses(c: Context, user: TelegramUser, limit: number, cursor?: string) {
    const result = await usersService.getUserExpenses(user.id, {
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

  async getDebts(c: Context, user: TelegramUser) {
    const groups = await usersService.getUserGroups(user.id);

    // Filter to only show groups where user has debt (negative balance)
    const debts = groups.filter((g) => g.balance < 0);

    return c.json({
      success: true,
      data: debts.map((d) => ({
        groupId: d.id,
        groupTitle: d.title,
        amount: Math.abs(d.balance),
        currency: d.currency,
      })),
    });
  }

  async getActivity(c: Context, user: TelegramUser, limit: number, cursor?: string) {
    // Return expenses as activity (enriched with groupTitle)
    const result = await usersService.getUserExpenses(user.id, {
      limit,
      lastKey: decodeCursor(cursor),
    });

    return c.json({
      success: true,
      data: result.items.map((e) => ({
        type: 'expense_paid' as const,
        id: e.id,
        groupId: e.groupId,
        groupTitle: e.groupTitle,
        amount: e.amount,
        currency: e.currency,
        description: e.description,
        createdAt: e.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    });
  }

  async getSummary(c: Context, user: TelegramUser) {
    const summary = await usersService.getUserSummary(user.id);
    const groups = await usersService.getUserGroups(user.id);

    // Find most active group
    const mostActiveGroup = groups.length > 0
      ? groups.reduce((max, g) => (g.expenseCount > max.expenseCount ? g : max), groups[0])
      : null;

    return c.json({
      success: true,
      data: {
        totalPaid: summary.totalPaid,
        totalReceived: summary.totalOwed,
        totalSettlementsSent: summary.settlementsCount,
        totalSettlementsReceived: 0,
        expenseCount: summary.expensesPaidCount,
        settlementCount: summary.settlementsCount,
        groupCount: summary.groupCount,
        mostActiveGroup: mostActiveGroup
          ? {
              id: mostActiveGroup.id,
              title: mostActiveGroup.title,
              expenseCount: mostActiveGroup.expenseCount,
            }
          : undefined,
      },
    });
  }

  async getLanguage(c: Context, user: TelegramUser) {
    const languageCode = await getUserLanguage(user.id);

    return c.json({
      success: true,
      data: {
        languageCode: languageCode || 'en',
      },
    });
  }

  async updateLanguage(c: Context, user: TelegramUser, languageCode: SupportedLanguage) {
    await setUserLanguage(user.id, languageCode);

    return c.json({
      success: true,
      data: {
        languageCode,
      },
    });
  }

  async getSettlements(c: Context, user: TelegramUser, limit: number, cursor?: string) {
    const result = await usersService.getUserSettlements(user.id, {
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

export const usersController = new UsersController();
