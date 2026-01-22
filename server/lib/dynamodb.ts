import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { config } from './config'

const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

const TABLE_NAME = config.TABLE_NAME

// Key Builders
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
}

// Types
export interface GroupRecord {
  PK: string
  SK: string
  id: string
  chatId: string
  title: string
  createdAt: string
  memberCount: number
}

export interface MemberRecord {
  PK: string
  SK: string
  id: string
  telegramId: number
  name: string
  username?: string
  wallet?: string
  avatarUrl?: string
  GSI1PK?: string
  GSI1SK?: string
}

// Alias for backwards compatibility
export type UserRecord = MemberRecord

export interface ExpenseRecord {
  PK: string
  SK: string
  id: string
  groupId: string
  payerId: string
  payerName: string
  amount: number
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: Array<{
    userId: string
    userName: string
    amount: number
    percentage?: number
  }>
  createdAt: string
  GSI2PK?: string
  GSI2SK?: string
}

export interface SettlementRecord {
  PK: string
  SK: string
  id: string
  groupId: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
  txHash?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  GSI2PK?: string
  GSI2SK?: string
}

// Pagination types
export interface PaginationOptions {
  limit?: number
  lastKey?: Record<string, unknown>
}

export interface PaginatedResult<T> {
  items: T[]
  lastKey?: Record<string, unknown>
  hasMore: boolean
}

// Operations

export async function getGroup(groupId: string): Promise<GroupRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
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
      TableName: TABLE_NAME,
      Item: item,
    })
  )
  return item
}

export async function getGroupsByUser(
  telegramId: number
): Promise<GroupRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${telegramId}`,
      },
    })
  )
  return (result.Items as GroupRecord[]) ?? []
}

export async function getUser(
  groupId: string,
  telegramId: number
): Promise<MemberRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
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
  }
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
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
      TableName: TABLE_NAME,
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
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'USER#',
      },
    })
  )
  return (result.Items as MemberRecord[]) ?? []
}

export async function getExpenses(
  groupId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'TX#',
      },
      ScanIndexForward: false, // newest first
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey as Record<string, any> | undefined,
    })
  )

  return {
    items: (result.Items as ExpenseRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

// Convenience method for backwards compatibility
export async function getAllExpenses(groupId: string): Promise<ExpenseRecord[]> {
  const result = await getExpenses(groupId)
  return result.items
}

export async function createExpense(
  expense: Omit<ExpenseRecord, 'PK' | 'SK' | 'GSI2PK' | 'GSI2SK'>
): Promise<ExpenseRecord> {
  const item: ExpenseRecord = {
    ...keys.expense(expense.groupId, expense.createdAt),
    ...expense,
    // GSI2 for efficient lookup by expense ID
    GSI2PK: `EXPENSE#${expense.id}`,
    GSI2SK: expense.groupId,
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
 * Get a single expense by ID using GSI2 (O(1) lookup)
 */
export async function getExpenseById(expenseId: string): Promise<ExpenseRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
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
  createdAt: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: keys.expense(groupId, createdAt),
    })
  )
}

export async function getSettlements(
  groupId: string,
  options?: PaginationOptions
): Promise<PaginatedResult<SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'SETTLE#',
      },
      ScanIndexForward: false,
      Limit: options?.limit,
      ExclusiveStartKey: options?.lastKey as Record<string, any> | undefined,
    })
  )

  return {
    items: (result.Items as SettlementRecord[]) ?? [],
    lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    hasMore: !!result.LastEvaluatedKey,
  }
}

// Convenience method for backwards compatibility
export async function getAllSettlements(groupId: string): Promise<SettlementRecord[]> {
  const result = await getSettlements(groupId)
  return result.items
}

export async function createSettlement(
  settlement: Omit<SettlementRecord, 'PK' | 'SK' | 'GSI2PK' | 'GSI2SK'>
): Promise<SettlementRecord> {
  const item: SettlementRecord = {
    ...keys.settlement(settlement.groupId, settlement.createdAt),
    ...settlement,
    // GSI2 for efficient lookup by settlement ID
    GSI2PK: `SETTLEMENT#${settlement.id}`,
    GSI2SK: settlement.groupId,
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
 * Get a single settlement by ID using GSI2 (O(1) lookup)
 */
export async function getSettlementById(settlementId: string): Promise<SettlementRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
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
  const updateExpression = txHash
    ? 'SET #status = :status, txHash = :txHash'
    : 'SET #status = :status'

  const expressionValues: Record<string, unknown> = {
    ':status': status,
  }

  if (txHash) {
    expressionValues[':txHash'] = txHash
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.settlement(groupId, createdAt),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
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
      TableName: TABLE_NAME,
      Key: keys.settlement(groupId, createdAt),
    })
  )
  return (result.Item as SettlementRecord) ?? null
}

// Batch operations
export async function batchCreateExpenses(
  expenses: Array<Omit<ExpenseRecord, 'PK' | 'SK'>>
): Promise<void> {
  if (expenses.length === 0) return

  // DynamoDB BatchWrite has a limit of 25 items
  const chunks: Array<Omit<ExpenseRecord, 'PK' | 'SK'>[]> = []
  for (let i = 0; i < expenses.length; i += 25) {
    chunks.push(expenses.slice(i, i + 25))
  }

  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map((expense) => ({
            PutRequest: {
              Item: {
                ...keys.expense(expense.groupId, expense.createdAt),
                ...expense,
              },
            },
          })),
        },
      })
    )
  }
}
