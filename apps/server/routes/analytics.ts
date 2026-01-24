import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { Env } from '../lib/factory'
import { getGroup, getGroupMembers } from '../lib/dynamodb'
import { authMiddleware, requireAuth, getCurrentUser } from '../middleware/auth'
import { calculateGroupAnalytics, generateExpenseReport } from '../lib/analytics'
import { generateExpenseCSV, generateSettlementCSV, generateGroupReportCSV, generateHTMLReport } from '../lib/export'
import { groupIdParamSchema } from '../lib/schemas'

export const analyticsRoutes = new Hono<Env>()

analyticsRoutes.use('*', authMiddleware)

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const exportFormatSchema = z.object({
  format: z.enum(['csv', 'html']).default('csv'),
  type: z.enum(['expenses', 'settlements', 'full']).default('full'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// GET /api/groups/:groupId/analytics - Get group analytics
analyticsRoutes.get(
  '/:groupId/analytics',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId } = c.req.valid('param')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Verify user is a member
    const members = await getGroupMembers(groupId)
    const isMember = members.some((m) => m.id === String(telegramUser.id))
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const analytics = await calculateGroupAnalytics(groupId)

    return c.json({
      success: true,
      data: {
        groupId,
        groupTitle: group.title,
        currency: group.currency ?? 'TON',
        ...analytics,
      },
    })
  }
)

// GET /api/groups/:groupId/export - Export group data
analyticsRoutes.get(
  '/:groupId/export',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('query', exportFormatSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { format, type, startDate, endDate } = c.req.valid('query')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Verify user is a member
    const members = await getGroupMembers(groupId)
    const isMember = members.some((m) => m.id === String(telegramUser.id))
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    let content: string
    let contentType: string
    let filename: string

    if (format === 'html') {
      content = await generateHTMLReport(groupId, startDate, endDate)
      contentType = 'text/html'
      filename = `fracti-report-${groupId}.html`
    } else {
      // CSV format
      switch (type) {
        case 'expenses':
          const expenses = await generateExpenseReport(groupId, undefined, startDate, endDate)
          content = generateExpenseCSV(expenses)
          filename = `fracti-expenses-${groupId}.csv`
          break
        case 'settlements':
          content = await generateSettlementCSV(groupId)
          filename = `fracti-settlements-${groupId}.csv`
          break
        default:
          content = await generateGroupReportCSV(groupId, startDate, endDate)
          filename = `fracti-report-${groupId}.csv`
      }
      contentType = 'text/csv'
    }

    return new Response(content, {
      headers: {
        'Content-Type': `${contentType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }
)

// GET /api/groups/:groupId/report - Get expense report data (JSON)
analyticsRoutes.get(
  '/:groupId/report',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('query', dateRangeSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const { startDate, endDate } = c.req.valid('query')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Verify user is a member
    const members = await getGroupMembers(groupId)
    const isMember = members.some((m) => m.id === String(telegramUser.id))
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const report = await generateExpenseReport(
      groupId,
      String(telegramUser.id),
      startDate,
      endDate
    )

    return c.json({
      success: true,
      data: report,
    })
  }
)
