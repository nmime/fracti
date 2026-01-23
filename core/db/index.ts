import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import $ from '@core/constants'
import type {
  GroupRecord,
  MemberRecord,
  ExpenseRecord,
  ExpenseSplit,
  ExpenseParticipantRecord,
  SettlementRecord,
  PaginationOptions,
  PaginatedResult,
  UserExpenseSummary,
} from '@core/types'

// Re-export types
export type {
  GroupRecord,
  MemberRecord,
  ExpenseRecord,
  ExpenseSplit,
  ExpenseParticipantRecord,
  SettlementRecord,
  PaginationOptions,
  PaginatedResult,
  UserExpenseSummary,
}

// Alias for backwards compatibility
export type UserRecord = MemberRecord

const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

const getTableName = () => process.env[$.env.TABLE_NAME] || $.dynamodb.tableName

// ============================================
// Key Builders
// ============================================

export const keys = {
  group: (groupId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: 'METADATA',
  }),
  user: (groupId: string, telegramId: number) => ({
    PK: `GROUP#${groupId}`,
    SK: `USER#${telegramId}`,
  }),
  expense: (groupId: string, timestamp: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `TX#${timestamp}`,
  }),
  settlement: (groupId: string, timestamp: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `SETTLE#${timestamp}`,
  }),
  expenseParticipant: (groupId: string, expenseId: string, userId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `PART#${expenseId}#${userId}`,
  }),
}

// ============================================
// Group Operations
// ============================================

export async function getGroup(groupId: string): Promise<GroupRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: keys.group(groupId),
    })
  )
  return (result.Item as GroupRecord) ?? null
}

export async function createGroup(
  group: Omit<GroupRecord, 'PK' | 'SK'>
): Promise<GroupRecord> {
  const item: GroupRecord = {
    ...keys.group(group.id),
    ...group,
  }
  await docClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    })
  )
  return item
}

export async function getGroupsByUser(
  telegramId: number
): Promise<MemberRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi1,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
        ':sk': 'GROUP#',
      },
    })
  )
  return (result.Items as MemberRecord[]) ?? []
}

// ============================================
// Member Operations
// ============================================

export async function getUser(
  groupId: string,
  telegramId: number
): Promise<MemberRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: keys.user(groupId, telegramId),
    })
  )
  return (result.Item as MemberRecord) ?? null
}

export async function upsertUser(
  groupId: string,
  user: Omit<MemberRecord, 'PK' | 'SK'>
): Promise<MemberRecord> {
  const item: MemberRecord = {
    ...keys.user(groupId, user.telegramId),
    ...user,
    GSI1PK: `USER#${user.telegramId}`,
    GSI1SK: `GROUP#${groupId}`,
    joinedAt: user.joinedAt ?? new Date().toISOString(),
  }
  await docClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    })
  )
  return item
}

export async function updateUserWallet(
  groupId: string,
  telegramId: number,
  wallet: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: keys.user(groupId, telegramId),
      UpdateExpression: 'SET wallet = :wallet',
      ExpressionAttributeValues: {
        ':wallet': wallet,
      },
    })
  )
}

export async function getGroupMembers(groupId: string): Promise<MemberRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'USER#',
      },
    })
  )
  return (result.Items as MemberRecord[]) ?? []
}

// ============================================
// Expense Operations
// ============================================

export async function getExpenses(
  groupId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'TX#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as ExpenseRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getAllExpenses(groupId: string): Promise<ExpenseRecord[]> {
  const allItems: ExpenseRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await getExpenses(groupId, { lastKey })
    allItems.push(...result.items)
    lastKey = result.lastKey
  } while (lastKey)

  return allItems
}

export interface CreateExpenseInput {
  id: string
  groupId: string
  groupTitle: string
  payerId: string
  payerName: string
  amount: number
  currency?: string
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: ExpenseSplit[]
  category?: string
  createdAt: string
}

export async function createExpense(
  expense: CreateExpenseInput
): Promise<ExpenseRecord> {
  const expenseItem: ExpenseRecord = {
    ...keys.expense(expense.groupId, expense.createdAt),
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
    GSI2PK: `EXPENSE#${expense.id}`,
    GSI2SK: expense.groupId,
    GSI3PK: `USER#${expense.payerId}`,
    GSI3SK: `TX#${expense.createdAt}`,
  }

  const participantItems: ExpenseParticipantRecord[] = expense.splits
    .filter((split) => split.userId !== expense.payerId)
    .map((split) => ({
      ...keys.expenseParticipant(expense.groupId, expense.id, split.userId),
      GSI1PK: `USER#${split.userId}`,
      GSI1SK: `OWES#${expense.createdAt}`,
      expenseId: expense.id,
      groupId: expense.groupId,
      groupTitle: expense.groupTitle,
      userId: split.userId,
      userName: split.userName,
      amount: split.amount,
      payerId: expense.payerId,
      payerName: expense.payerName,
      description: expense.description,
      totalAmount: expense.amount,
      createdAt: expense.createdAt,
    }))

  if (participantItems.length > 0) {
    const transactItems = [
      {
        Put: {
          TableName: getTableName(),
          Item: expenseItem,
        },
      },
      ...participantItems.map((item) => ({
        Put: {
          TableName: getTableName(),
          Item: item,
        },
      })),
    ]

    if (transactItems.length <= 100) {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      )
    } else {
      await docClient.send(
        new PutCommand({
          TableName: getTableName(),
          Item: expenseItem,
        })
      )
      await batchWriteParticipants(participantItems)
    }
  } else {
    await docClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: expenseItem,
      })
    )
  }

  return expenseItem
}

async function batchWriteParticipants(
  items: ExpenseParticipantRecord[]
): Promise<void> {
  const chunks: ExpenseParticipantRecord[][] = []
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25))
  }

  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [getTableName()]: chunk.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    )
  }
}

export async function getExpenseById(expenseId: string): Promise<ExpenseRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi2,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `EXPENSE#${expenseId}`,
      },
      Limit: 1,
    })
  )
  return (result.Items?.[0] as ExpenseRecord) ?? null
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
  createdAt: string
): Promise<void> {
  const participantsResult = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': `PART#${expenseId}#`,
      },
    })
  )

  const participants = (participantsResult.Items as ExpenseParticipantRecord[]) ?? []

  const deleteItems = [
    {
      Delete: {
        TableName: getTableName(),
        Key: keys.expense(groupId, createdAt),
      },
    },
    ...participants.map((p) => ({
      Delete: {
        TableName: getTableName(),
        Key: { PK: p.PK, SK: p.SK },
      },
    })),
  ]

  if (deleteItems.length <= 100) {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: deleteItems,
      })
    )
  } else {
    await docClient.send(
      new DeleteCommand({
        TableName: getTableName(),
        Key: keys.expense(groupId, createdAt),
      })
    )

    const deleteChunks: Array<{ PK: string; SK: string }[]> = []
    const keysToDelete = participants.map((p) => ({ PK: p.PK, SK: p.SK }))
    for (let i = 0; i < keysToDelete.length; i += 25) {
      deleteChunks.push(keysToDelete.slice(i, i + 25))
    }

    for (const chunk of deleteChunks) {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [getTableName()]: chunk.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
        })
      )
    }
  }
}

// ============================================
// Settlement Operations
// ============================================

export async function getSettlements(
  groupId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'SETTLE#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as SettlementRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getAllSettlements(groupId: string): Promise<SettlementRecord[]> {
  const allItems: SettlementRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await getSettlements(groupId, { lastKey })
    allItems.push(...result.items)
    lastKey = result.lastKey
  } while (lastKey)

  return allItems
}

export async function createSettlement(
  settlement: Omit<SettlementRecord, 'PK' | 'SK' | 'GSI2PK' | 'GSI2SK' | 'GSI3PK' | 'GSI3SK'>
): Promise<SettlementRecord> {
  const item: SettlementRecord = {
    ...keys.settlement(settlement.groupId, settlement.createdAt),
    ...settlement,
    GSI2PK: `SETTLEMENT#${settlement.id}`,
    GSI2SK: settlement.groupId,
    GSI3PK: `USER#${settlement.fromUserId}`,
    GSI3SK: `SETTLE#${settlement.createdAt}`,
  }
  await docClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    })
  )
  return item
}

export async function getSettlementById(settlementId: string): Promise<SettlementRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi2,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SETTLEMENT#${settlementId}`,
      },
      Limit: 1,
    })
  )
  return (result.Items?.[0] as SettlementRecord) ?? null
}

export async function updateSettlementStatus(
  groupId: string,
  createdAt: string,
  status: SettlementRecord['status'],
  txHash?: string
): Promise<void> {
  const updateExpressionParts = ['#status = :status']
  const expressionValues: Record<string, unknown> = { ':status': status }
  const expressionNames: Record<string, string> = { '#status': 'status' }

  if (txHash) {
    updateExpressionParts.push('txHash = :txHash')
    expressionValues[':txHash'] = txHash
  }

  if (status === 'completed') {
    updateExpressionParts.push('completedAt = :completedAt')
    expressionValues[':completedAt'] = new Date().toISOString()
  }

  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: keys.settlement(groupId, createdAt),
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
  )
}

export async function getSettlementByCreatedAt(
  groupId: string,
  createdAt: string
): Promise<SettlementRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: keys.settlement(groupId, createdAt),
    })
  )
  return (result.Item as SettlementRecord) ?? null
}

// ============================================
// User-Centric Operations
// ============================================

export async function getExpensesPaidByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi3,
      KeyConditionExpression: 'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
        ':sk': 'TX#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as ExpenseRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getExpensesOwedByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseParticipantRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi1,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
        ':sk': 'OWES#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as ExpenseParticipantRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getSettlementsByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi3,
      KeyConditionExpression: 'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
        ':sk': 'SETTLE#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as SettlementRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getUserActivity(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord | SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: $.dynamodb.gsi.gsi3,
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey,
    })
  )

  return {
    items: (result.Items as (ExpenseRecord | SettlementRecord)[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

export async function getUserSummary(telegramId: number): Promise<UserExpenseSummary> {
  const [expensesPaid, expensesOwed, settlements, memberships] = await Promise.all([
    getAllExpensesPaidByUser(telegramId),
    getAllExpensesOwedByUser(telegramId),
    getAllSettlementsByUser(telegramId),
    getGroupsByUser(telegramId),
  ])

  const totalPaid = expensesPaid.reduce((sum, e) => sum + e.amount, 0)
  const totalOwed = expensesOwed.reduce((sum, e) => sum + e.amount, 0)
  const settledAmount = settlements
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.amount, 0)

  return {
    totalPaid,
    totalOwed,
    netBalance: totalPaid - totalOwed + settledAmount,
    expensesPaidCount: expensesPaid.length,
    expensesOwedCount: expensesOwed.length,
    settlementsCount: settlements.length,
    groupCount: memberships.length,
  }
}

async function getAllExpensesPaidByUser(telegramId: number): Promise<ExpenseRecord[]> {
  const allItems: ExpenseRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await getExpensesPaidByUser(telegramId, { lastKey })
    allItems.push(...result.items)
    lastKey = result.lastKey
  } while (lastKey)

  return allItems
}

async function getAllExpensesOwedByUser(telegramId: number): Promise<ExpenseParticipantRecord[]> {
  const allItems: ExpenseParticipantRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await getExpensesOwedByUser(telegramId, { lastKey })
    allItems.push(...result.items)
    lastKey = result.lastKey
  } while (lastKey)

  return allItems
}

async function getAllSettlementsByUser(telegramId: number): Promise<SettlementRecord[]> {
  const allItems: SettlementRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await getSettlementsByUser(telegramId, { lastKey })
    allItems.push(...result.items)
    lastKey = result.lastKey
  } while (lastKey)

  return allItems
}

export async function batchCreateExpenses(
  expenses: Array<CreateExpenseInput>
): Promise<void> {
  if (expenses.length === 0) return

  for (const expense of expenses) {
    await createExpense(expense)
  }
}
