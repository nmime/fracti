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
import { config } from './config'

const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

const TABLE_NAME = config.TABLE_NAME

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
// Types
// ============================================

export interface GroupRecord {
  PK: string
  SK: string
  id: string
  chatId: string
  title: string
  currency?: string
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
  joinedAt?: string
  GSI1PK?: string
  GSI1SK?: string
}

// Alias for backwards compatibility
export type UserRecord = MemberRecord

export interface ExpenseSplit {
  userId: string
  userName: string
  amount: number
  percentage?: number
}

export interface ExpenseRecord {
  PK: string
  SK: string
  id: string
  groupId: string
  payerId: string
  payerName: string
  amount: number
  currency?: string
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: ExpenseSplit[]
  category?: string
  createdAt: string
  // GSI2: Entity lookup
  GSI2PK?: string
  GSI2SK?: string
  // GSI3: User activity (expenses paid by user)
  GSI3PK?: string
  GSI3SK?: string
}

export interface ExpenseParticipantRecord {
  PK: string
  SK: string
  // GSI1: User's debts
  GSI1PK: string
  GSI1SK: string
  expenseId: string
  groupId: string
  groupTitle: string
  userId: string
  userName: string
  amount: number
  payerId: string
  payerName: string
  description: string
  totalAmount: number
  createdAt: string
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
  currency?: string
  txHash?: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  // GSI2: Entity lookup
  GSI2PK?: string
  GSI2SK?: string
  // GSI3: User activity (settlements made by user)
  GSI3PK?: string
  GSI3SK?: string
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationOptions {
  limit?: number
  lastKey?: Record<string, unknown>
}

export interface PaginatedResult<T> {
  items: T[]
  lastKey?: Record<string, unknown>
  hasMore: boolean
}

// ============================================
// User Summary Types
// ============================================

export interface UserExpenseSummary {
  totalPaid: number
  totalOwed: number
  netBalance: number
  expensesPaidCount: number
  expensesOwedCount: number
  settlementsCount: number
  groupCount: number
}

export interface UserActivityItem {
  type: 'expense_paid' | 'expense_owed' | 'settlement_sent' | 'settlement_received'
  id: string
  groupId: string
  groupTitle?: string
  amount: number
  description?: string
  otherPartyId?: string
  otherPartyName?: string
  createdAt: string
}

// ============================================
// Group Operations
// ============================================

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
): Promise<MemberRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
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
    joinedAt: user.joinedAt ?? new Date().toISOString(),
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

// ============================================
// Expense Operations
// ============================================

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

export async function getExpenseCount(groupId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'TX#',
      },
      Select: 'COUNT',
    })
  )
  return result.Count ?? 0
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

/**
 * Creates an expense with participant records for beneficiary queries.
 * Uses TransactWriteItems for atomic operation.
 */
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
    // GSI2: Entity lookup by expense ID
    GSI2PK: `EXPENSE#${expense.id}`,
    GSI2SK: expense.groupId,
    // GSI3: User activity (expenses paid by this user)
    GSI3PK: `USER#${expense.payerId}`,
    GSI3SK: `TX#${expense.createdAt}`,
  }

  // Create participant records for non-payer beneficiaries
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

  // If we have participants, use transaction for atomicity
  if (participantItems.length > 0) {
    const transactItems = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: expenseItem,
        },
      },
      ...participantItems.map((item) => ({
        Put: {
          TableName: TABLE_NAME,
          Item: item,
        },
      })),
    ]

    // DynamoDB TransactWrite limit is 100 items
    // For large splits, fall back to batch writes
    if (transactItems.length <= 100) {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      )
    } else {
      // Fall back to individual writes for very large splits
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: expenseItem,
        })
      )
      await batchWriteParticipants(participantItems)
    }
  } else {
    // No participants (payer paid for themselves only)
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
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
          [TABLE_NAME]: chunk.map((item) => ({
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

/**
 * Deletes an expense and all its participant records.
 */
export async function deleteExpense(
  groupId: string,
  expenseId: string,
  createdAt: string
): Promise<void> {
  // First, get all participant records for this expense
  const participantsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': `PART#${expenseId}#`,
      },
    })
  )

  const participants = (participantsResult.Items as ExpenseParticipantRecord[]) ?? []

  // Delete expense and participants
  const deleteItems = [
    {
      Delete: {
        TableName: TABLE_NAME,
        Key: keys.expense(groupId, createdAt),
      },
    },
    ...participants.map((p) => ({
      Delete: {
        TableName: TABLE_NAME,
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
    // Fall back to batch delete for large participant lists
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
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
            [TABLE_NAME]: chunk.map((key) => ({
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
      TableName: TABLE_NAME,
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
    // GSI2: Entity lookup by settlement ID
    GSI2PK: `SETTLEMENT#${settlement.id}`,
    GSI2SK: settlement.groupId,
    // GSI3: User activity (settlements made by this user)
    GSI3PK: `USER#${settlement.fromUserId}`,
    GSI3SK: `SETTLE#${settlement.createdAt}`,
  }
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  )
  return item
}

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
      TableName: TABLE_NAME,
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
      TableName: TABLE_NAME,
      Key: keys.settlement(groupId, createdAt),
    })
  )
  return (result.Item as SettlementRecord) ?? null
}

// ============================================
// User-Centric Operations (NEW)
// ============================================

/**
 * Get all expenses paid by a user across all groups (GSI3)
 */
export async function getExpensesPaidByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
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

/**
 * Get all expenses where user owes money (GSI1 with OWES# prefix)
 */
export async function getExpensesOwedByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseParticipantRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
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

/**
 * Get all settlements made by a user across all groups (GSI3)
 */
export async function getSettlementsByUser(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
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

/**
 * Get all user activity (expenses paid + settlements made) from GSI3
 */
export async function getUserActivity(
  telegramId: number,
  options?: PaginationOptions
): Promise<PaginatedResult<ExpenseRecord | SettlementRecord>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
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

/**
 * Get user's financial summary across all groups
 */
export async function getUserSummary(telegramId: number): Promise<UserExpenseSummary> {
  // Fetch all user data in parallel
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

// Helper functions to fetch all items (no pagination)
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

// ============================================
// Batch Operations
// ============================================

export async function batchCreateExpenses(
  expenses: Array<CreateExpenseInput>
): Promise<void> {
  if (expenses.length === 0) return

  // For batch operations, we create expenses individually to maintain
  // participant record creation (transactional integrity)
  for (const expense of expenses) {
    await createExpense(expense)
  }
}
