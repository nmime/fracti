import { z } from 'zod';

// ============================================
// Constants
// ============================================

export const DefaultCurrency = 'USDT';

// ============================================
// Telegram Types
// ============================================

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramTheme {
  colorScheme: 'light' | 'dark';
  backgroundColor: string;
  textColor: string;
  hintColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryBackgroundColor: string;
}

export interface DeepLinkParams {
  groupId?: string;
  action?: 'view' | 'settle' | 'expense' | 'analytics' | 'recurring';
  expenseId?: string;
}

// ============================================
// Database Record Types
// ============================================

export interface GroupRecord {
  PK: string;
  SK: string;
  id: string;
  chatId: string;
  title: string;
  currency?: string;
  createdAt: string;
  memberCount: number;
}

export interface MemberRecord {
  PK: string;
  SK: string;
  id: string;
  telegramId: number;
  name: string;
  username?: string;
  wallet?: string;
  avatarUrl?: string;
  joinedAt?: string;
  GSI1PK?: string;
  GSI1SK?: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amount: number;
  percentage?: number;
}

export interface ExpenseRecord {
  PK: string;
  SK: string;
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency?: string;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  category?: string;
  createdAt: string;
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;
}

export interface ExpenseParticipantRecord {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  expenseId: string;
  groupId: string;
  groupTitle: string;
  userId: string;
  userName: string;
  amount: number;
  payerId: string;
  payerName: string;
  description: string;
  totalAmount: number;
  createdAt: string;
}

export interface SettlementRecord {
  PK: string;
  SK: string;
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency?: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  GSI3PK?: string;
  GSI3SK?: string;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginationOptions {
  limit?: number;
  lastKey?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  lastKey?: Record<string, unknown>;
  hasMore: boolean;
}

// ============================================
// User Summary Types
// ============================================

export interface UserExpenseSummary {
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
  expensesPaidCount: number;
  expensesOwedCount: number;
  settlementsCount: number;
  groupCount: number;
}

export interface UserActivityItem {
  type: 'expense_paid' | 'expense_owed' | 'settlement_sent' | 'settlement_received';
  id: string;
  groupId: string;
  groupTitle?: string;
  amount: number;
  description?: string;
  otherPartyId?: string;
  otherPartyName?: string;
  createdAt: string;
}

export interface GroupActivityItem {
  type: 'expense' | 'settlement';
  id: string;
  userId: string;
  userName: string;
  amount: number;
  description?: string;
  otherPartyId?: string;
  otherPartyName?: string;
  createdAt: string;
}

// ============================================
// Database Input Types
// ============================================

export interface DbCreateGroupInput {
  id: string;
  chatId: string;
  title: string;
  currency?: string;
  createdAt: string;
  memberCount: number;
}

export interface DbCreateMemberInput {
  id: string;
  telegramId: number;
  name: string;
  username?: string;
  wallet?: string;
  avatarUrl?: string;
  joinedAt?: string;
}

export interface DbCreateExpenseInput {
  id: string;
  groupId: string;
  groupTitle: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency?: string;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  category?: string;
  createdAt: string;
}

export interface DbCreateSettlementInput {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency?: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

// ============================================
// API Types
// ============================================

export interface ApiError {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================
// Zod Schemas
// ============================================

export const safeAmount = z
  .number()
  .positive('Amount must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'Amount too large')
  .refine((n) => Number.isFinite(n), 'Amount must be a finite number');

export const tonWalletAddress = z.string().regex(/^(EQ|UQ)[A-Za-z0-9_-]{46}$/, 'Invalid TON wallet address format');

export const base64Image = z
  .string()
  .min(1, 'Image is required')
  .max(1_400_000, 'Image too large (max 1MB)')
  .refine((s) => /^[A-Za-z0-9+/=]+$/.test(s), 'Invalid base64 encoding')
  .refine((s) => s.length % 4 === 0, 'Invalid base64 padding');

export const txHash = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

export const currencyCode = z.string().min(2, 'Currency code too short').max(5, 'Currency code too long').toUpperCase();

export const expenseCategory = z
  .enum([
    'food',
    'transport',
    'entertainment',
    'shopping',
    'utilities',
    'rent',
    'travel',
    'health',
    'education',
    'other',
  ])
  .optional();

// ============================================
// Input Schemas
// ============================================

export const groupIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const createGroupSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  chatId: z.union([z.string(), z.number()]).transform(String),
});

export const joinGroupSchema = z.object({
  wallet: tonWalletAddress.optional(),
});

export const updateWalletSchema = z.object({
  wallet: tonWalletAddress,
});

export const splitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  amount: safeAmount.optional(),
  percentage: z.number().min(0).max(100).optional(),
});

export const createExpenseSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  amount: safeAmount,
  description: z.string().min(1, 'Description is required').max(200, 'Description too long').trim(),
  splitType: z.enum(['equal', 'exact', 'percentage']).default('equal'),
  splits: z.array(splitSchema).min(1, 'At least one split required').max(50, 'Too many splits'),
  currency: currencyCode.optional(),
  category: expenseCategory,
});

export const createSettlementSchema = z.object({
  toId: z.string().min(1, 'Recipient ID is required'),
  amount: safeAmount,
  txHash: txHash.optional(),
});

export const updateSettlementSchema = z.object({
  txHash: txHash.optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

export const parseTextSchema = z.object({
  text: z.string().min(1, 'Text is required').max(1000, 'Text too long').trim(),
  context: z
    .object({
      members: z.array(z.string()).max(100).optional(),
      groupId: z.string().optional(),
    })
    .optional(),
});

export const parseVisionSchema = z.object({
  image: base64Image,
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).default('image/jpeg'),
});

export const parsedExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string(),
  payer: z.string().optional(),
  beneficiaries: z.array(z.string()).optional(),
  category: expenseCategory.optional(),
  confidence: z.number().min(0).max(1),
});

export const parsedReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().positive().default(1),
  price: z.number().positive(),
});

export const parsedReceiptSchema = z.object({
  items: z.array(parsedReceiptItemSchema),
  total: z.number().positive(),
  tax: z.number().optional(),
  subtotal: z.number().optional(),
  currency: z.string().default(DefaultCurrency),
  merchant: z.string().optional(),
  date: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

// ============================================
// Inferred Types
// ============================================

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>;
export type ParseTextInput = z.infer<typeof parseTextSchema>;
export type ParseVisionInput = z.infer<typeof parseVisionSchema>;
export type ParsedExpense = z.infer<typeof parsedExpenseSchema>;
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;

// Re-export zod for convenience
export { z };
