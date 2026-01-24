import { BaseRepository, TransactWriteCommand, QueryCommand } from './base.repository'
import { keys, GSI_PREFIXES, docClient, TABLE_NAME } from '../integrations/dynamodb'
import type {
  ExpenseRecord,
  ExpenseParticipantRecord,
  CreateExpenseInput,
  PaginationOptions,
  PaginatedResult,
} from '../types/db.types'

class ExpensesRepository extends BaseRepository {
  async findByGroup(
    groupId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseRecord>> {
    return this.query<ExpenseRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': GSI_PREFIXES.TX,
      },
      { ...options, scanForward: false }
    )
  }

  async findAllByGroup(groupId: string): Promise<ExpenseRecord[]> {
    return this.queryAll<ExpenseRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': GSI_PREFIXES.TX,
      },
      { scanForward: false }
    )
  }

  async findById(expenseId: string): Promise<ExpenseRecord | null> {
    const result = await this.query<ExpenseRecord>(
      'GSI2PK = :pk',
      { ':pk': `${GSI_PREFIXES.EXPENSE}${expenseId}` },
      { indexName: 'GSI2' }
    )
    return result.items[0] ?? null
  }

  async countByGroup(groupId: string): Promise<number> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
          ':sk': GSI_PREFIXES.TX,
        },
        Select: 'COUNT',
      })
    )
    return result.Count ?? 0
  }

  async create(input: CreateExpenseInput): Promise<ExpenseRecord> {
    const expenseItem: ExpenseRecord = {
      ...keys.expense(input.groupId, input.createdAt),
      id: input.id,
      groupId: input.groupId,
      payerId: input.payerId,
      payerName: input.payerName,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      splitType: input.splitType,
      splits: input.splits,
      category: input.category,
      createdAt: input.createdAt,
      GSI2PK: `${GSI_PREFIXES.EXPENSE}${input.id}`,
      GSI2SK: input.groupId,
      GSI3PK: `${GSI_PREFIXES.USER}${input.payerId}`,
      GSI3SK: `${GSI_PREFIXES.TX}${input.createdAt}`,
    }

    const participantItems: ExpenseParticipantRecord[] = input.splits
      .filter((split) => split.userId !== input.payerId)
      .map((split) => ({
        ...keys.expenseParticipant(input.groupId, input.id, split.userId),
        GSI1PK: `${GSI_PREFIXES.USER}${split.userId}`,
        GSI1SK: `${GSI_PREFIXES.OWES}${input.createdAt}`,
        expenseId: input.id,
        groupId: input.groupId,
        groupTitle: input.groupTitle,
        userId: split.userId,
        userName: split.userName,
        amount: split.amount,
        payerId: input.payerId,
        payerName: input.payerName,
        description: input.description,
        totalAmount: input.amount,
        createdAt: input.createdAt,
      }))

    if (participantItems.length > 0) {
      const transactItems = [
        { Put: { TableName: TABLE_NAME, Item: expenseItem } },
        ...participantItems.map((item) => ({
          Put: { TableName: TABLE_NAME, Item: item },
        })),
      ]

      if (transactItems.length <= 100) {
        await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }))
      } else {
        await this.put(expenseItem)
        await this.batchWriteParticipants(participantItems)
      }
    } else {
      await this.put(expenseItem)
    }

    return expenseItem
  }

  private async batchWriteParticipants(items: ExpenseParticipantRecord[]): Promise<void> {
    await this.batchWrite(items.map((item) => ({ PutRequest: { Item: item } })))
  }

  async deleteWithParticipants(
    groupId: string,
    expenseId: string,
    createdAt: string
  ): Promise<void> {
    const participantsResult = await this.query<ExpenseParticipantRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': `PART#${expenseId}#`,
      }
    )

    const participants = participantsResult.items
    const deleteItems = [
      { Delete: { TableName: TABLE_NAME, Key: keys.expense(groupId, createdAt) } },
      ...participants.map((p) => ({
        Delete: { TableName: TABLE_NAME, Key: { PK: p.PK, SK: p.SK } },
      })),
    ]

    if (deleteItems.length <= 100) {
      await docClient.send(new TransactWriteCommand({ TransactItems: deleteItems }))
    } else {
      await this.delete(keys.expense(groupId, createdAt))
      await this.batchWrite(
        participants.map((p) => ({
          DeleteRequest: { Key: { PK: p.PK, SK: p.SK } },
        }))
      )
    }
  }

  // User-centric queries
  async findPaidByUser(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseRecord>> {
    return this.query<ExpenseRecord>(
      'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.USER}${telegramId}`,
        ':sk': GSI_PREFIXES.TX,
      },
      { ...options, indexName: 'GSI3', scanForward: false }
    )
  }

  async findOwedByUser(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<ExpenseParticipantRecord>> {
    return this.query<ExpenseParticipantRecord>(
      'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.USER}${telegramId}`,
        ':sk': GSI_PREFIXES.OWES,
      },
      { ...options, indexName: 'GSI1', scanForward: false }
    )
  }
}

export const expensesRepository = new ExpensesRepository()
