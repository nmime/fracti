import { HTTPException } from 'hono/http-exception';
import { getUser } from '@libs/db';
import { groupsService, recurringService } from '../services';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';
import type { ExpenseSplit } from '@libs/types';

interface CreateRecurringInput {
  name: string;
  payerId: string;
  amount: number;
  currency?: string;
  description: string;
  splitType?: 'equal' | 'exact' | 'percentage';
  splits: { userId: string; amount?: number; percentage?: number }[];
  category?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate?: string;
}

function formatTemplate(t: {
  id: string;
  groupId: string;
  name: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency?: string;
  description: string;
  splitType: string;
  splits: ExpenseSplit[];
  category?: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  lastRun?: string;
  nextRun: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}) {
  return {
    id: t.id,
    groupId: t.groupId,
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
  };
}

export class RecurringController {
  async getAll(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    const templates = await recurringService.getRecurringTemplates(groupId);

    return c.json({
      success: true,
      data: templates.map(formatTemplate),
    });
  }

  async getOne(c: Context, user: TelegramUser, groupId: string, templateId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    const template = await recurringService.getRecurringTemplate(groupId, templateId);
    if (!template) {
      throw new HTTPException(404, { message: 'Recurring template not found' });
    }

    return c.json({
      success: true,
      data: formatTemplate(template),
    });
  }

  async create(c: Context, user: TelegramUser, groupId: string, input: CreateRecurringInput) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Get current user's member record for proper UUID
    const currentMember = await getUser(groupId, user.id);
    if (!currentMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    // Get payer info
    const members = await groupsService.getGroupMembers(groupId);
    const payer = members.find((m) => m.id === input.payerId);
    if (!payer) {
      throw new HTTPException(400, { message: 'Payer not found in group' });
    }

    // Build splits with names
    const splits: ExpenseSplit[] = input.splits.map((s) => {
      const member = members.find((m) => m.id === s.userId);
      return {
        userId: s.userId,
        userName: member?.name || 'Unknown',
        amount: s.amount || input.amount / input.splits.length,
        percentage: s.percentage,
      };
    });

    // Calculate next run date
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const nextRun = recurringService.calculateNextRun(input.frequency, startDate, {
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
    });

    const template = await recurringService.createRecurringTemplate({
      groupId,
      name: input.name,
      payerId: input.payerId,
      payerName: payer.name,
      amount: input.amount,
      currency: input.currency || group.currency,
      description: input.description,
      splitType: input.splitType || 'equal',
      splits,
      category: input.category,
      frequency: input.frequency,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      nextRun,
      createdBy: currentMember.id,
    });

    return c.json({
      success: true,
      data: formatTemplate(template),
    });
  }

  async delete(c: Context, user: TelegramUser, groupId: string, templateId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    await recurringService.deleteRecurringTemplate(groupId, templateId);

    return c.json({
      success: true,
      data: { deleted: true },
    });
  }

  async getDue(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    const templates = await recurringService.getDueTemplatesByGroup(groupId);

    return c.json({
      success: true,
      data: templates.map(formatTemplate),
    });
  }
}

export const recurringController = new RecurringController();
