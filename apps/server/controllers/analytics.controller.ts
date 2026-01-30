import { HTTPException } from 'hono/http-exception';
import { analyticsService, groupsService } from '../services';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';

export class AnalyticsController {
  async getGroupAnalytics(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getGroupAnalytics] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId);

    return c.json({
      success: true,
      data: analytics,
    });
  }

  async getSummary(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getSummary] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId);

    return c.json({
      success: true,
      data: {
        totalExpenses: analytics.totalExpenses,
        expenseCount: analytics.expenseCount,
        averageExpense: analytics.averageExpense,
        largestExpense: analytics.largestExpense,
        mostActiveSpender: analytics.memberStats[0]
          ? {
              userId: analytics.memberStats[0].userId,
              userName: analytics.memberStats[0].userName,
              totalSpent: analytics.memberStats[0].totalPaid,
            }
          : null,
      },
    });
  }

  async getCategoryBreakdown(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getCategoryBreakdown] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId);

    return c.json({
      success: true,
      data: analytics.expensesByCategory,
    });
  }
}

export const analyticsController = new AnalyticsController();
