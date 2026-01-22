import { randomUUID } from 'crypto'
import {
  docClient,
  keys,
  type ExpenseSplit,
  createExpense,
  getGroup,
} from './dynamodb'
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import { config } from './config'
import { logger } from './logger'
import { notifyNewExpense } from './notifications'

const TABLE_NAME = config.TABLE_NAME

/**
 * Recurring expense template record
 */
export interface RecurringTemplateRecord {
  PK: string
  SK: string
  id: string
  groupId: string
  name: string
  payerId: string
  payerName: string
  amount: number
  currency?: string
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: ExpenseSplit[]
  category?: string
  // Recurrence settings
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  dayOfWeek?: number // 0-6 for weekly
  dayOfMonth?: number // 1-31 for monthly
  monthOfYear?: number // 1-12 for yearly
  // Tracking
  lastRun?: string
  nextRun: string
  isActive: boolean
  createdAt: string
  createdBy: string
  // GSI for querying by next run date
  GSI1PK?: string
  GSI1SK?: string
}

/**
 * Key builders for recurring templates
 */
export const recurringKeys = {
  template: (groupId: string, templateId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `RECURRING#${templateId}`,
  }),
}

/**
 * Create a new recurring expense template
 */
export async function createRecurringTemplate(
  template: Omit<RecurringTemplateRecord, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>
): Promise<RecurringTemplateRecord> {
  const item: RecurringTemplateRecord = {
    ...recurringKeys.template(template.groupId, template.id),
    ...template,
    GSI1PK: 'RECURRING',
    GSI1SK: template.nextRun,
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  )

  return item
}

/**
 * Get all recurring templates for a group
 */
export async function getRecurringTemplates(
  groupId: string
): Promise<RecurringTemplateRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'RECURRING#',
      },
    })
  )

  return (result.Items as RecurringTemplateRecord[]) ?? []
}

/**
 * Get a single recurring template
 */
export async function getRecurringTemplate(
  groupId: string,
  templateId: string
): Promise<RecurringTemplateRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: recurringKeys.template(groupId, templateId),
    })
  )

  return (result.Item as RecurringTemplateRecord) ?? null
}

/**
 * Delete a recurring template
 */
export async function deleteRecurringTemplate(
  groupId: string,
  templateId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: recurringKeys.template(groupId, templateId),
    })
  )
}

/**
 * Update template's next run date after processing
 */
export async function updateTemplateNextRun(
  groupId: string,
  templateId: string,
  lastRun: string,
  nextRun: string
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...recurringKeys.template(groupId, templateId),
        lastRun,
        nextRun,
        GSI1SK: nextRun,
      },
      ConditionExpression: 'attribute_exists(PK)',
    })
  )
}

/**
 * Get all templates due for processing
 */
export async function getDueTemplates(
  beforeDate: string
): Promise<RecurringTemplateRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :date',
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':pk': 'RECURRING',
        ':date': beforeDate,
        ':active': true,
      },
    })
  )

  return (result.Items as RecurringTemplateRecord[]) ?? []
}

/**
 * Calculate next run date based on frequency
 */
export function calculateNextRun(
  frequency: RecurringTemplateRecord['frequency'],
  fromDate: Date = new Date(),
  options?: {
    dayOfWeek?: number
    dayOfMonth?: number
    monthOfYear?: number
  }
): string {
  const next = new Date(fromDate)

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break

    case 'weekly':
      next.setDate(next.getDate() + 7)
      if (options?.dayOfWeek !== undefined) {
        const currentDay = next.getDay()
        const daysUntil = (options.dayOfWeek - currentDay + 7) % 7 || 7
        next.setDate(next.getDate() + daysUntil)
      }
      break

    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (options?.dayOfMonth !== undefined) {
        next.setDate(Math.min(options.dayOfMonth, getDaysInMonth(next)))
      }
      break

    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      if (options?.monthOfYear !== undefined) {
        next.setMonth(options.monthOfYear - 1)
      }
      if (options?.dayOfMonth !== undefined) {
        next.setDate(Math.min(options.dayOfMonth, getDaysInMonth(next)))
      }
      break
  }

  return next.toISOString()
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Process a single recurring template - create the expense
 */
export async function processRecurringTemplate(
  template: RecurringTemplateRecord
): Promise<void> {
  const now = new Date().toISOString()

  try {
    // Get group info for notification
    const group = await getGroup(template.groupId)
    if (!group) {
      logger.error('Group not found for recurring template', {
        templateId: template.id,
        groupId: template.groupId,
      })
      return
    }

    // Create the expense
    const expenseId = randomUUID()
    await createExpense({
      id: expenseId,
      groupId: template.groupId,
      groupTitle: group.title,
      payerId: template.payerId,
      payerName: template.payerName,
      amount: template.amount,
      currency: template.currency ?? group.currency,
      description: `${template.description} (recurring)`,
      splitType: template.splitType,
      splits: template.splits,
      category: template.category,
      createdAt: now,
    })

    // Calculate next run date
    const nextRun = calculateNextRun(template.frequency, new Date(), {
      dayOfWeek: template.dayOfWeek,
      dayOfMonth: template.dayOfMonth,
      monthOfYear: template.monthOfYear,
    })

    // Update template
    await updateTemplateNextRun(template.groupId, template.id, now, nextRun)

    // Send notification
    await notifyNewExpense(
      group.chatId,
      template.payerName,
      template.amount,
      template.currency ?? group.currency ?? 'TON',
      `${template.description} (recurring)`,
      template.splits
    )

    logger.info('Processed recurring template', {
      templateId: template.id,
      expenseId,
      nextRun,
    })
  } catch (error) {
    logger.error(
      'Failed to process recurring template',
      { templateId: template.id },
      error as Error
    )
    throw error
  }
}

/**
 * Process all due recurring templates
 * This should be called by a scheduled Lambda or cron job
 */
export async function processAllDueTemplates(): Promise<{
  processed: number
  failed: number
}> {
  const now = new Date().toISOString()
  const templates = await getDueTemplates(now)

  let processed = 0
  let failed = 0

  for (const template of templates) {
    try {
      await processRecurringTemplate(template)
      processed++
    } catch {
      failed++
    }
  }

  logger.info('Processed recurring templates', { processed, failed, total: templates.length })

  return { processed, failed }
}
