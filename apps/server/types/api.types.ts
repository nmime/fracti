import type { TelegramUser } from '../integrations/telegram'

/**
 * API response types
 */

export interface ApiError {
  success: false
  error: string
  message?: string
  details?: unknown
  requestId?: string
}

export interface ApiSuccess<T> {
  success: true
  data: T
  requestId?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export interface PaginatedApiResponse<T> {
  success: true
  data: T[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
  }
  requestId?: string
}

/**
 * Hono environment bindings
 */
export interface Env {
  Bindings: {
    TABLE_NAME: string
    BEDROCK_MODEL_ID: string
    TELEGRAM_BOT_TOKEN: string
    MINI_APP_URL: string
    NODE_ENV: string
  }
  Variables: {
    telegramUser: TelegramUser | null
    isAuthenticated: boolean
    authMethod: 'init_data' | 'widget' | 'dev' | null
    requestId: string
  }
}

/**
 * Group API response types
 */
export interface GroupResponse {
  id: string
  chatId: string
  title: string
  currency?: string
  createdAt: string
  memberCount: number
}

export interface GroupWithMembersResponse extends GroupResponse {
  members: MemberResponse[]
}

export interface MemberResponse {
  id: string
  name: string
  username?: string
  wallet?: string
  avatarUrl?: string
}

/**
 * Expense API response types
 */
export interface ExpenseResponse {
  id: string
  groupId: string
  payerId: string
  payerName: string
  amount: number
  currency?: string
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: ExpenseSplitResponse[]
  category?: string
  createdAt: string
}

export interface ExpenseSplitResponse {
  userId: string
  userName: string
  amount: number
  percentage?: number
}

/**
 * Settlement API response types
 */
export interface SettlementResponse {
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
}

/**
 * Debt calculation types
 */
export interface DebtResponse {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

/**
 * Analytics types
 */
export interface AnalyticsSummaryResponse {
  totalExpenses: number
  totalAmount: number
  averageExpense: number
  largestExpense: number
  mostActiveSpender: {
    userId: string
    userName: string
    totalSpent: number
  } | null
}

export interface CategoryBreakdownResponse {
  category: string
  totalAmount: number
  count: number
  percentage: number
}

/**
 * AI parsing types
 */
export interface ParsedExpenseResponse {
  amount: number
  description: string
  payer?: string
  beneficiaries?: string[]
  confidence: number
}

export interface ParsedReceiptItemResponse {
  name: string
  quantity: number
  price: number
}

export interface ParsedReceiptResponse {
  items: ParsedReceiptItemResponse[]
  total: number
  tax?: number
  subtotal?: number
  currency: string
  merchant?: string
  date?: string
  confidence: number
}

/**
 * User types
 */
export interface UserProfileResponse {
  id: string
  name: string
  username?: string
  summary: {
    totalPaid: number
    totalOwed: number
    netBalance: number
    expensesPaidCount: number
    expensesOwedCount: number
    settlementsCount: number
    groupCount: number
  }
}

export interface UserGroupBalanceResponse {
  groupId: string
  groupTitle: string
  balance: number
  currency?: string
}
