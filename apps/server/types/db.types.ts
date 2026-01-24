/**
 * Database record types for DynamoDB single-table design
 */

// Base record with partition and sort keys
export interface BaseRecord {
  PK: string
  SK: string
}

// Group metadata record
export interface GroupRecord extends BaseRecord {
  id: string
  chatId: string
  title: string
  currency?: string
  createdAt: string
  memberCount: number
}

// Member record (user in a group)
export interface MemberRecord extends BaseRecord {
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

// Expense split detail
export interface ExpenseSplit {
  userId: string
  userName: string
  amount: number
  percentage?: number
}

// Expense record
export interface ExpenseRecord extends BaseRecord {
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

// Expense participant record (for debt tracking)
export interface ExpenseParticipantRecord extends BaseRecord {
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

// Settlement record
export interface SettlementRecord extends BaseRecord {
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

// User summary types
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

// Input types for creating records
export interface CreateGroupInput {
  id: string
  chatId: string
  title: string
  currency?: string
  createdAt: string
  memberCount: number
}

export interface CreateMemberInput {
  id: string
  telegramId: number
  name: string
  username?: string
  wallet?: string
  avatarUrl?: string
  joinedAt?: string
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

export interface CreateSettlementInput {
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
}
