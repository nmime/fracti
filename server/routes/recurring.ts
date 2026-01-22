import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { randomUUID } from 'crypto'

import type { Env } from '../lib/factory'
import { getGroup, getGroupMembers } from '../lib/dynamodb'
import { authMiddleware, requireAuth, getCurrentUser } from '../middleware/auth'
import {
  createRecurringTemplate,
  getRecurringTemplates,
  getRecurringTemplate,
  deleteRecurringTemplate,
  calculateNextRun,
  processAllDueTemplates,
} from '../lib/recurring'
import { notifyRecurringExpense } from '../lib/notifications'
import { groupIdParamSchema, safeAmount } from '../lib/schemas'

export const recurringRoutes = new Hono<Env>()

recurringRoutes.use('*', authMiddleware)

const createRecurringSchema = z.object({
  name: z.string().min(1).max(100),
  payerId: z.string().min(1),
  amount: safeAmount,
  currency: z.string().optional(),
  description: z.string().min(1).max(200),
  splitType: z.enum(['equal', 'exact', 'percentage']).default('equal'),
  splits: z.array(z.object({
    userId: z.string().min(1),
    amount: safeAmount.optional(),
    percentage: z.number().min(0).max(100).optional(),
  })).min(1),
  category: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  monthOfYear: z.number().min(1).max(12).optional(),
  startDate: z.string().optional(), // ISO date string
})

const templateIdParamSchema = groupIdParamSchema.extend({
  templateId: z.string().uuid(),
})

// GET /api/groups/:groupId/recurring - List recurring templates
recurringRoutes.get(
  '/:groupId/recurring',
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

    const templates = await getRecurringTemplates(groupId)

    return c.json({
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        payerId: t.payerId,
        payerName: t.payerName,
        amount: t.amount,
        currency: t.currency,
        description: t.description,
        splitType: t.splitType,
        splits: t.splits,
        category: t.category,
        frequency: t.frequency,
        dayOfWeek: t.dayOfWeek,
        dayOfMonth: t.dayOfMonth,
        monthOfYear: t.monthOfYear,
        lastRun: t.lastRun,
        nextRun: t.nextRun,
        isActive: t.isActive,
        createdAt: t.createdAt,
        createdBy: t.createdBy,
      })),
    })
  }
)

// POST /api/groups/:groupId/recurring - Create recurring template
recurringRoutes.post(
  '/:groupId/recurring',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', createRecurringSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId } = c.req.valid('param')
    const body = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    // Get members to resolve names
    const members = await getGroupMembers(groupId)
    const memberMap = new Map(members.map((m) => [m.id, m]))

    // Verify user is a member
    if (!memberMap.has(String(telegramUser.id))) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const payer = memberMap.get(body.payerId)
    if (!payer) {
      throw new HTTPException(400, { message: 'Payer not found in group' })
    }

    const id = randomUUID()
    const now = new Date()
    const startDate = body.startDate ? new Date(body.startDate) : now

    // Calculate next run date
    const nextRun = calculateNextRun(body.frequency, startDate, {
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
      monthOfYear: body.monthOfYear,
    })

    const template = await createRecurringTemplate({
      id,
      groupId,
      name: body.name,
      payerId: body.payerId,
      payerName: payer.name,
      amount: body.amount,
      currency: body.currency ?? group.currency,
      description: body.description,
      splitType: body.splitType,
      splits: body.splits.map((s) => {
        const member = memberMap.get(s.userId)
        return {
          userId: s.userId,
          userName: member?.name ?? 'Unknown',
          amount: s.amount ?? body.amount / body.splits.length,
          percentage: s.percentage,
        }
      }),
      category: body.category,
      frequency: body.frequency,
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
      monthOfYear: body.monthOfYear,
      nextRun,
      isActive: true,
      createdAt: now.toISOString(),
      createdBy: String(telegramUser.id),
    })

    // Send notification
    await notifyRecurringExpense(
      group.chatId,
      body.name,
      body.amount,
      body.currency ?? group.currency ?? 'TON',
      nextRun
    )

    return c.json({ success: true, data: template }, 201)
  }
)

// GET /api/groups/:groupId/recurring/:templateId - Get single template
recurringRoutes.get(
  '/:groupId/recurring/:templateId',
  requireAuth,
  zValidator('param', templateIdParamSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId, templateId } = c.req.valid('param')

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

    const template = await getRecurringTemplate(groupId, templateId)
    if (!template) {
      throw new HTTPException(404, { message: 'Recurring template not found' })
    }

    return c.json({ success: true, data: template })
  }
)

// DELETE /api/groups/:groupId/recurring/:templateId - Delete template
recurringRoutes.delete(
  '/:groupId/recurring/:templateId',
  requireAuth,
  zValidator('param', templateIdParamSchema),
  async (c) => {
    const telegramUser = getCurrentUser(c)
    const { groupId, templateId } = c.req.valid('param')

    const template = await getRecurringTemplate(groupId, templateId)
    if (!template) {
      throw new HTTPException(404, { message: 'Recurring template not found' })
    }

    // Only creator can delete
    if (template.createdBy !== String(telegramUser.id)) {
      throw new HTTPException(403, { message: 'Only the creator can delete this template' })
    }

    await deleteRecurringTemplate(groupId, templateId)

    return c.json({ success: true, message: 'Recurring template deleted' })
  }
)

// POST /api/recurring/process - Process all due templates (called by scheduler)
recurringRoutes.post('/process', async (c) => {
  // This endpoint should be protected by API key or internal auth in production
  const result = await processAllDueTemplates()

  return c.json({
    success: true,
    data: result,
  })
})
