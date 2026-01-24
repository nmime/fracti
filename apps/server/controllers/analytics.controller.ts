import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { analyticsService } from '../services/analytics.service'
import { groupsService } from '../services/groups.service'
import type { TelegramUser } from '../integrations/telegram'

export class AnalyticsController {
  async getGroupAnalytics(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId)

    return c.json({
      success: true,
      data: analytics,
    })
  }

  async getSummary(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId)

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
    })
  }

  async getCategoryBreakdown(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const analytics = await analyticsService.getGroupAnalytics(groupId)

    return c.json({
      success: true,
      data: analytics.expensesByCategory,
    })
  }
}

export const analyticsController = new AnalyticsController()
