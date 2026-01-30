import { HTTPException } from 'hono/http-exception';
import { getUser } from '@libs/db';
import { expensesService, groupsService } from '../services';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';

export class ExpensesController {
  async list(c: Context, user: TelegramUser, groupId: string, limit: number, cursor?: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[list expenses] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    const result = await expensesService.getExpensesByGroup(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    });

    return c.json({
      success: true,
      data: result.items.map((e) => ({
        id: e.id,
        groupId: e.groupId,
        payerId: e.payerId,
        payerName: e.payerName,
        amount: e.amount,
        currency: e.currency,
        description: e.description,
        splitType: e.splitType,
        splits: e.splits,
        category: e.category,
        createdAt: e.createdAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    });
  }

  async getById(c: Context, user: TelegramUser, groupId: string, expenseId: string) {
    const expense = await expensesService.getExpenseById(expenseId);

    if (!expense) {
      throw new HTTPException(404, { message: 'Expense not found' });
    }

    if (expense.groupId !== groupId) {
      throw new HTTPException(404, { message: 'Expense not found in this group' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getById expense] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    return c.json({
      success: true,
      data: {
        id: expense.id,
        groupId: expense.groupId,
        payerId: expense.payerId,
        payerName: expense.payerName,
        amount: expense.amount,
        currency: expense.currency,
        description: expense.description,
        splitType: expense.splitType,
        splits: expense.splits,
        category: expense.category,
        createdAt: expense.createdAt,
      },
    });
  }

  async create(
    c: Context,
    groupId: string,
    params: {
      payerId: string;
      amount: number;
      description: string;
      splitType: 'equal' | 'exact' | 'percentage';
      splits: { userId: string; amount?: number; percentage?: number }[];
      currency?: string;
      category?: string;
    },
  ) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    try {
      const expense = await expensesService.createExpense({
        groupId,
        ...params,
      });

      return c.json(
        {
          success: true,
          data: {
            id: expense.id,
            groupId: expense.groupId,
            payerId: expense.payerId,
            payerName: expense.payerName,
            amount: expense.amount,
            currency: expense.currency,
            description: expense.description,
            splitType: expense.splitType,
            splits: expense.splits,
            category: expense.category,
            createdAt: expense.createdAt,
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Payer not found in group') {
        throw new HTTPException(400, { message: error.message });
      }

      throw error;
    }
  }

  async delete(c: Context, user: TelegramUser, groupId: string, expenseId: string) {
    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[delete expense] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    // Get the current user's member record to get their UUID
    const currentMember = await getUser(groupId, user.id);
    if (!currentMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    try {
      await expensesService.deleteExpense(groupId, expenseId, currentMember.id);

      return c.json({ success: true, message: 'Expense deleted' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Expense not found') {
          throw new HTTPException(404, { message: error.message });
        }

        if (error.message === 'Only the payer can delete this expense') {
          throw new HTTPException(403, { message: error.message });
        }

        if (error.message === 'Expense not found in this group') {
          throw new HTTPException(404, { message: error.message });
        }
      }

      throw error;
    }
  }
}

export const expensesController = new ExpensesController();
