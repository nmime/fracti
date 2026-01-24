import { randomUUID } from 'crypto'
import { expensesRepository } from '../repositories/expenses.repository'
import { membersRepository } from '../repositories/members.repository'
import { groupsRepository } from '../repositories/groups.repository'
import type {
  ExpenseRecord,
  CreateExpenseInput as DbCreateExpenseInput,
  PaginationOptions,
  PaginatedResult,
} from '../types/db.types'
import { createMemberMap } from '../utils'

export interface CreateExpenseParams {
  groupId: string
  payerId: string
  amount: number
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: Array<{ userId: string; amount?: number; percentage?: number }>
  currency?: string
  category?: string
}

class ExpensesService {
  async getExpensesByGroup(
    groupId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseRecord>> {
    return expensesRepository.findByGroup(groupId, options)
  }

  async getAllExpensesByGroup(groupId: string): Promise<ExpenseRecord[]> {
    return expensesRepository.findAllByGroup(groupId)
  }

  async getExpenseById(expenseId: string): Promise<ExpenseRecord | null> {
    return expensesRepository.findById(expenseId)
  }

  async createExpense(params: CreateExpenseParams): Promise<ExpenseRecord> {
    const { groupId, payerId, amount, description, splitType, splits, currency, category } = params

    const [group, members] = await Promise.all([
      groupsRepository.findById(groupId),
      membersRepository.findByGroup(groupId),
    ])

    if (!group) {
      throw new Error('Group not found')
    }

    const memberMap = createMemberMap(members)
    const payer = memberMap.get(payerId)

    if (!payer) {
      throw new Error('Payer not found in group')
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    const input: DbCreateExpenseInput = {
      id,
      groupId,
      groupTitle: group.title,
      payerId,
      payerName: payer.name,
      amount,
      currency: currency ?? group.currency,
      description,
      splitType,
      splits: splits.map((s) => {
        const member = memberMap.get(s.userId)
        return {
          userId: s.userId,
          userName: member?.name ?? 'Unknown',
          amount: s.amount ?? amount / splits.length,
          percentage: s.percentage,
        }
      }),
      category,
      createdAt: now,
    }

    return expensesRepository.create(input)
  }

  async deleteExpense(
    groupId: string,
    expenseId: string,
    userId: string
  ): Promise<void> {
    const expense = await expensesRepository.findById(expenseId)

    if (!expense) {
      throw new Error('Expense not found')
    }

    if (expense.groupId !== groupId) {
      throw new Error('Expense not found in this group')
    }

    if (expense.payerId !== userId) {
      throw new Error('Only the payer can delete this expense')
    }

    await expensesRepository.deleteWithParticipants(groupId, expenseId, expense.createdAt)
  }

  async getExpensesPaidByUser(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseRecord>> {
    return expensesRepository.findPaidByUser(telegramId, options)
  }

  async getExpenseCount(groupId: string): Promise<number> {
    return expensesRepository.countByGroup(groupId)
  }
}

export const expensesService = new ExpensesService()
