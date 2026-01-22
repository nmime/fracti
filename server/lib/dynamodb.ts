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

const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

const TABLE_NAME = process.env.TABLE_NAME!

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

export interface UserRecord {
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
}

// Operations

export async function getGroup(groupId: string): Promise<GroupRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.group(groupId),
    })
  )
  return (result.Item as GroupRecord) || null
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
  return (result.Items as GroupRecord[]) || []
}

export async function getUser(
  groupId: string,
  telegramId: number
): Promise<UserRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: keys.user(groupId, telegramId),
    })
  )
  return (result.Item as UserRecord) || null
}

export async function upsertUser(
  groupId: string,
  user: Omit<UserRecord, 'PK' | 'SK'>
): Promise<UserRecord> {
  const item: UserRecord = {
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

export async function getGroupMembers(groupId: string): Promise<UserRecord[]> {
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
  return (result.Items as UserRecord[]) || []
}

export async function getExpenses(groupId: string): Promise<ExpenseRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'TX#',
      },
      ScanIndexForward: false, // newest first
    })
  )
  return (result.Items as ExpenseRecord[]) || []
}

export async function createExpense(
  expense: Omit<ExpenseRecord, 'PK' | 'SK'>
): Promise<ExpenseRecord> {
  const item: ExpenseRecord = {
    ...keys.expense(expense.groupId, expense.createdAt),
    ...expense,
  }
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  )
  return item
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
  groupId: string
): Promise<SettlementRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':sk': 'SETTLE#',
      },
      ScanIndexForward: false,
    })
  )
  return (result.Items as SettlementRecord[]) || []
}

export async function createSettlement(
  settlement: Omit<SettlementRecord, 'PK' | 'SK'>
): Promise<SettlementRecord> {
  const item: SettlementRecord = {
    ...keys.settlement(settlement.groupId, settlement.createdAt),
    ...settlement,
  }
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  )
  return item
}

export async function updateSettlementStatus(
  groupId: string,
  createdAt: string,
  status: SettlementRecord['status'],
  txHash?: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: keys.settlement(groupId, createdAt),
      UpdateExpression: 'SET #status = :status, txHash = :txHash',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':txHash': txHash,
      },
    })
  )
}
