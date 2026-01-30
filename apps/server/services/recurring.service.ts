import { randomUUID } from 'crypto';
import {
  createRecurringTemplate as createTemplate,
  getRecurringTemplates as getTemplates,
  getRecurringTemplate as getTemplate,
  deleteRecurringTemplate as deleteTemplate,
  updateTemplateNextRun as updateNextRun,
  getDueTemplates,
  getDueTemplatesByGroup,
  calculateNextRun as calcNextRun,
  processRecurringTemplate as processTemplate,
  processAllDueTemplates as processAllDue,
} from '../lib/recurring';
import type { RecurringTemplateRecord } from '../lib/recurring';
import type { ExpenseSplit } from '@libs/types';

export interface CreateRecurringTemplateParams {
  groupId: string;
  name: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency?: string;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  category?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  nextRun: string;
  createdBy: string;
}

class RecurringService {
  async createRecurringTemplate(params: CreateRecurringTemplateParams): Promise<RecurringTemplateRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const template: Omit<RecurringTemplateRecord, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'> = {
      id,
      groupId: params.groupId,
      name: params.name,
      payerId: params.payerId,
      payerName: params.payerName,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      splitType: params.splitType,
      splits: params.splits,
      category: params.category,
      frequency: params.frequency,
      dayOfWeek: params.dayOfWeek,
      dayOfMonth: params.dayOfMonth,
      monthOfYear: params.monthOfYear,
      nextRun: params.nextRun,
      isActive: true,
      createdAt: now,
      createdBy: params.createdBy,
    };

    return createTemplate(template);
  }

  async getRecurringTemplates(groupId: string): Promise<RecurringTemplateRecord[]> {
    return getTemplates(groupId);
  }

  async getRecurringTemplate(groupId: string, templateId: string): Promise<RecurringTemplateRecord | null> {
    return getTemplate(groupId, templateId);
  }

  async deleteRecurringTemplate(groupId: string, templateId: string): Promise<void> {
    const template = await getTemplate(groupId, templateId);

    if (!template) {
      throw new Error('Recurring template not found');
    }

    if (template.groupId !== groupId) {
      throw new Error('Template not found in this group');
    }

    await deleteTemplate(groupId, templateId);
  }

  async updateTemplateNextRun(groupId: string, templateId: string, lastRun: string, nextRun: string): Promise<void> {
    await updateNextRun(groupId, templateId, lastRun, nextRun);
  }

  async getDueTemplates(beforeDate?: string): Promise<RecurringTemplateRecord[]> {
    const date = beforeDate ?? new Date().toISOString();

    return getDueTemplates(date);
  }

  async getDueTemplatesByGroup(groupId: string, beforeDate?: string): Promise<RecurringTemplateRecord[]> {
    return getDueTemplatesByGroup(groupId, beforeDate);
  }

  calculateNextRun(
    frequency: RecurringTemplateRecord['frequency'],
    fromDate?: Date,
    options?: {
      dayOfWeek?: number;
      dayOfMonth?: number;
      monthOfYear?: number;
    },
  ): string {
    return calcNextRun(frequency, fromDate, options);
  }

  async processRecurringTemplate(template: RecurringTemplateRecord): Promise<void> {
    await processTemplate(template);
  }

  async processAllDueTemplates(): Promise<{ processed: number; failed: number }> {
    return processAllDue();
  }
}

export const recurringService = new RecurringService();
