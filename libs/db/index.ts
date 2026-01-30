import { randomUUID } from 'crypto';
import { Service, type EntityItem } from 'electrodb';
import { client, docClient, TABLE_NAME } from './client';
import { GroupEntity, MemberEntity, ExpenseEntity, ExpenseParticipantEntity, SettlementEntity, UserSessionEntity } from './entities';
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
} from '@libs/types';

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
};

// Export clients for direct access
export { docClient, client, TABLE_NAME };

/**
 * ElectroDB Service - unified database layer
 *
 * Supports:
 * - AWS DynamoDB (default)
 * - ScyllaDB Alternator (via DB_ENDPOINT env)
 * - LocalStack / Local DynamoDB (via DB_ENDPOINT env)
 */
export const db = new Service(
  {
    group: GroupEntity,
    member: MemberEntity,
    expense: ExpenseEntity,
    expenseParticipant: ExpenseParticipantEntity,
    settlement: SettlementEntity,
    userSession: UserSessionEntity,
  },
  {
    client,
    table: TABLE_NAME,
  },
);

// Export entity item types
export type Group = EntityItem<typeof GroupEntity>;
export type Member = EntityItem<typeof MemberEntity>;
export type Expense = EntityItem<typeof ExpenseEntity>;
export type ExpenseParticipant = EntityItem<typeof ExpenseParticipantEntity>;
export type Settlement = EntityItem<typeof SettlementEntity>;
export type UserSession = EntityItem<typeof UserSessionEntity>;

// Re-export entities
export * from './entities';

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
};

// ============================================
// Helper to convert ElectroDB result to record
// ============================================

function toGroupRecord(data: Group): GroupRecord {
  return {
    PK: `GROUP#${data.id}`,
    SK: 'METADATA',
    id: data.id,
    chatId: data.chatId,
    title: data.title,
    currency: data.currency,
    memberCount: data.memberCount ?? 0,
    createdAt: data.createdAt,
  };
}

function toMemberRecord(data: Member): MemberRecord {
  return {
    PK: `GROUP#${data.groupId}`,
    SK: `USER#${data.telegramId}`,
    id: data.id,
    telegramId: data.telegramId,
    name: data.name,
    username: data.username,
    wallet: data.wallet,
    avatarUrl: data.avatarUrl,
    joinedAt: data.joinedAt,
    GSI1PK: `USER#${data.telegramId}`,
    GSI1SK: `GROUP#${data.groupId}`,
  };
}

function toExpenseRecord(data: Expense): ExpenseRecord {
  return {
    PK: `GROUP#${data.groupId}`,
    SK: `TX#${data.createdAt}`,
    id: data.id,
    groupId: data.groupId,
    payerId: data.payerId,
    payerName: data.payerName,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    splitType: data.splitType,
    splits: data.splits ?? [],
    category: data.category,
    createdAt: data.createdAt,
    GSI2PK: `EXPENSE#${data.id}`,
    GSI2SK: data.groupId,
    GSI3PK: `USER#${data.payerId}`,
    GSI3SK: `TX#${data.createdAt}`,
  };
}

function toExpenseParticipantRecord(data: ExpenseParticipant): ExpenseParticipantRecord {
  return {
    PK: `GROUP#${data.groupId}`,
    SK: `PART#${data.expenseId}#${data.userId}`,
    GSI1PK: `USER#${data.userId}`,
    GSI1SK: `TX#${data.createdAt}#${data.expenseId}`,
    expenseId: data.expenseId,
    groupId: data.groupId,
    groupTitle: data.groupTitle,
    userId: data.userId,
    userName: data.userName,
    amount: data.amount,
    payerId: data.payerId,
    payerName: data.payerName,
    description: data.description,
    totalAmount: data.totalAmount,
    createdAt: data.createdAt,
  };
}

function toSettlementRecord(data: Settlement): SettlementRecord {
  return {
    PK: `GROUP#${data.groupId}`,
    SK: `SETTLE#${data.createdAt}`,
    id: data.id,
    groupId: data.groupId,
    fromUserId: data.fromUserId,
    fromUserName: data.fromUserName,
    toUserId: data.toUserId,
    toUserName: data.toUserName,
    amount: data.amount,
    currency: data.currency,
    txHash: data.txHash,
    status: data.status,
    createdAt: data.createdAt,
    completedAt: data.completedAt,
    GSI2PK: `SETTLEMENT#${data.id}`,
    GSI2SK: data.groupId,
    GSI3PK: `USER#${data.fromUserId}`,
    GSI3SK: `SETTLE#${data.createdAt}`,
  };
}

// ============================================
// Group Operations
// ============================================

export async function getGroup(groupId: string): Promise<GroupRecord | null> {
  const { data } = await db.entities.group.get({ id: groupId }).go();

  return data ? toGroupRecord(data) : null;
}

export async function createGroup(group: Omit<GroupRecord, 'PK' | 'SK'>): Promise<GroupRecord> {
  const { data } = await db.entities.group
    .create({
      id: group.id,
      chatId: group.chatId,
      title: group.title,
      currency: group.currency,
      memberCount: group.memberCount,
      createdAt: group.createdAt,
    })
    .go();

  return toGroupRecord(data);
}

export async function getGroupsByUser(telegramId: number): Promise<MemberRecord[]> {
  console.log('[getGroupsByUser] Querying with telegramId:', telegramId, 'type:', typeof telegramId);
  const { data } = await db.entities.member.query.byUser({ telegramId }).go();
  console.log('[getGroupsByUser] Raw data from query:', JSON.stringify(data));

  return data.map((m) => toMemberRecord(m));
}

// ============================================
// Member Operations
// ============================================

export async function getUser(groupId: string, telegramId: number): Promise<MemberRecord | null> {
  const { data } = await db.entities.member.get({ groupId, telegramId }).go();

  return data ? toMemberRecord(data) : null;
}

export async function upsertUser(
  groupId: string,
  user: Omit<MemberRecord, 'PK' | 'SK' | 'id'> & { id?: string },
): Promise<MemberRecord> {
  console.log('[upsertUser] Input:', { groupId, telegramId: user.telegramId, telegramIdType: typeof user.telegramId });

  // Check if user already exists to preserve their ID
  const existingUser = await getUser(groupId, user.telegramId);
  const memberId = existingUser?.id ?? user.id ?? randomUUID();

  const { data } = await db.entities.member
    .upsert({
      id: memberId,
      groupId,
      telegramId: user.telegramId,
      name: user.name,
      username: user.username,
      wallet: user.wallet,
      avatarUrl: user.avatarUrl,
      joinedAt: user.joinedAt ?? existingUser?.joinedAt ?? new Date().toISOString(),
    })
    .go();

  console.log('[upsertUser] Result data:', JSON.stringify(data));

  return toMemberRecord(data as Member);
}

export async function updateUserWallet(groupId: string, telegramId: number, wallet: string): Promise<void> {
  await db.entities.member.patch({ groupId, telegramId }).set({ wallet }).go();
}

export async function getGroupMembers(groupId: string): Promise<MemberRecord[]> {
  const { data } = await db.entities.member.query.primary({ groupId }).go();

  return data.map((m) => toMemberRecord(m));
}

// ============================================
// Expense Operations
// ============================================

export async function getExpenses(
  groupId: string,
  options?: PaginationOptions,
): Promise<PaginatedResult<ExpenseRecord>> {
  const { data, cursor } = await db.entities.expense.query.primary({ groupId }).go({
    order: 'desc',
    limit: options?.limit,
    cursor: options?.lastKey as string | undefined,
  });

  return {
    items: data.map((e) => toExpenseRecord(e)),
    lastKey: cursor ? { cursor } : undefined,
    hasMore: !!cursor,
  };
}

export async function getAllExpenses(groupId: string): Promise<ExpenseRecord[]> {
  const { data } = await db.entities.expense.query.primary({ groupId }).go({ order: 'desc' });

  return data.map((e) => toExpenseRecord(e));
}

export interface CreateExpenseInput {
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

export async function createExpense(expense: CreateExpenseInput): Promise<ExpenseRecord> {
  const { data } = await db.entities.expense
    .create({
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
    })
    .go();

  // Create participant records for debt tracking
  const participants = expense.splits.filter((split) => split.userId !== expense.payerId);

  if (participants.length > 0) {
    await Promise.all(
      participants.map((split) =>
        db.entities.expenseParticipant
          .create({
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
          })
          .go(),
      ),
    );
  }

  return toExpenseRecord(data);
}

export async function getExpenseById(expenseId: string): Promise<ExpenseRecord | null> {
  const { data } = await db.entities.expense.scan.where((attr, op) => op.eq(attr.id, expenseId)).go();

  return data[0] ? toExpenseRecord(data[0]) : null;
}

export async function deleteExpense(groupId: string, expenseId: string, createdAt: string): Promise<void> {
  // Find and delete participants
  const { data: participants } = await db.entities.expenseParticipant.query
    .primary({ groupId })
    .where((attr, op) => op.eq(attr.expenseId, expenseId))
    .go();

  await Promise.all([
    db.entities.expense.delete({ groupId, createdAt }).go(),
    ...participants.map((p) =>
      db.entities.expenseParticipant
        .delete({
          groupId: p.groupId,
          expenseId: p.expenseId,
          userId: p.userId,
        })
        .go(),
    ),
  ]);
}

// ============================================
// Settlement Operations
// ============================================

export async function getSettlements(
  groupId: string,
  options?: PaginationOptions,
): Promise<PaginatedResult<SettlementRecord>> {
  const { data, cursor } = await db.entities.settlement.query.primary({ groupId }).go({
    order: 'desc',
    limit: options?.limit,
    cursor: options?.lastKey as string | undefined,
  });

  return {
    items: data.map((s) => toSettlementRecord(s)),
    lastKey: cursor ? { cursor } : undefined,
    hasMore: !!cursor,
  };
}

export async function getAllSettlements(groupId: string): Promise<SettlementRecord[]> {
  const { data } = await db.entities.settlement.query.primary({ groupId }).go({ order: 'desc' });

  return data.map((s) => toSettlementRecord(s));
}

export async function createSettlement(
  settlement: Omit<SettlementRecord, 'PK' | 'SK' | 'GSI2PK' | 'GSI2SK' | 'GSI3PK' | 'GSI3SK'>,
): Promise<SettlementRecord> {
  const { data } = await db.entities.settlement
    .create({
      id: settlement.id,
      groupId: settlement.groupId,
      fromUserId: settlement.fromUserId,
      fromUserName: settlement.fromUserName,
      toUserId: settlement.toUserId,
      toUserName: settlement.toUserName,
      amount: settlement.amount,
      currency: settlement.currency,
      txHash: settlement.txHash,
      status: settlement.status,
      createdAt: settlement.createdAt,
      completedAt: settlement.completedAt,
    })
    .go();

  return toSettlementRecord(data);
}

export async function getSettlementById(settlementId: string): Promise<SettlementRecord | null> {
  const { data } = await db.entities.settlement.scan.where((attr, op) => op.eq(attr.id, settlementId)).go();

  return data[0] ? toSettlementRecord(data[0]) : null;
}

export async function updateSettlementStatus(
  groupId: string,
  createdAt: string,
  status: SettlementRecord['status'],
  txHash?: string,
): Promise<void> {
  const patch = db.entities.settlement.patch({ groupId, createdAt }).set({ status });

  if (txHash) {
    patch.set({ txHash });
  }

  if (status === 'completed') {
    patch.set({ completedAt: new Date().toISOString() });
  }

  await patch.go();
}

export async function getSettlementByCreatedAt(groupId: string, createdAt: string): Promise<SettlementRecord | null> {
  const { data } = await db.entities.settlement.get({ groupId, createdAt }).go();

  return data ? toSettlementRecord(data) : null;
}

// ============================================
// User-Centric Operations
// ============================================

export async function getExpensesPaidByUser(
  telegramId: number,
  options?: PaginationOptions,
): Promise<PaginatedResult<ExpenseRecord>> {
  // Get all group memberships for this user to find their member IDs
  const memberships = await getGroupsByUser(telegramId);
  const memberIds = memberships.map((m) => m.id);

  if (memberIds.length === 0) {
    return { items: [], lastKey: undefined, hasMore: false };
  }

  // Query expenses for each member ID and combine results
  const allExpenses: ExpenseRecord[] = [];
  for (const memberId of memberIds) {
    const { data } = await db.entities.expense.query.byPayer({ payerId: memberId }).go({
      order: 'desc',
    });
    allExpenses.push(...data.map((e) => toExpenseRecord(e)));
  }

  // Sort by createdAt descending and apply pagination
  allExpenses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limit = options?.limit ?? allExpenses.length;
  const items = allExpenses.slice(0, limit);

  return {
    items,
    lastKey: items.length < allExpenses.length ? { cursor: 'more' } : undefined,
    hasMore: items.length < allExpenses.length,
  };
}

export async function getExpensesOwedByUser(
  telegramId: number,
  options?: PaginationOptions,
): Promise<PaginatedResult<ExpenseParticipantRecord>> {
  // Get all group memberships for this user to find their member IDs
  const memberships = await getGroupsByUser(telegramId);
  const memberIds = memberships.map((m) => m.id);

  if (memberIds.length === 0) {
    return { items: [], lastKey: undefined, hasMore: false };
  }

  // Query expense participants for each member ID and combine results
  const allParticipants: ExpenseParticipantRecord[] = [];
  for (const memberId of memberIds) {
    const { data } = await db.entities.expenseParticipant.query.byUser({ userId: memberId }).go({
      order: 'desc',
    });
    allParticipants.push(...data.map((p) => toExpenseParticipantRecord(p)));
  }

  // Sort by createdAt descending and apply pagination
  allParticipants.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limit = options?.limit ?? allParticipants.length;
  const items = allParticipants.slice(0, limit);

  return {
    items,
    lastKey: items.length < allParticipants.length ? { cursor: 'more' } : undefined,
    hasMore: items.length < allParticipants.length,
  };
}

export async function getSettlementsByUser(
  telegramId: number,
  options?: PaginationOptions,
): Promise<PaginatedResult<SettlementRecord>> {
  // Get all group memberships for this user to find their member IDs
  const memberships = await getGroupsByUser(telegramId);
  const memberIds = memberships.map((m) => m.id);

  if (memberIds.length === 0) {
    return { items: [], lastKey: undefined, hasMore: false };
  }

  // Query settlements for each member ID and combine results
  const allSettlements: SettlementRecord[] = [];
  for (const memberId of memberIds) {
    const { data } = await db.entities.settlement.query.byFromUser({ fromUserId: memberId }).go({
      order: 'desc',
    });
    allSettlements.push(...data.map((s) => toSettlementRecord(s)));
  }

  // Sort by createdAt descending and apply pagination
  allSettlements.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limit = options?.limit ?? allSettlements.length;
  const items = allSettlements.slice(0, limit);

  return {
    items,
    lastKey: items.length < allSettlements.length ? { cursor: 'more' } : undefined,
    hasMore: items.length < allSettlements.length,
  };
}

export async function getUserActivity(
  telegramId: number,
  options?: PaginationOptions,
): Promise<PaginatedResult<ExpenseRecord | SettlementRecord>> {
  // Get both expenses and settlements, then merge
  const [expenses, settlements] = await Promise.all([
    getExpensesPaidByUser(telegramId, options),
    getSettlementsByUser(telegramId, options),
  ]);

  const items = [...expenses.items, ...settlements.items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    items: options?.limit ? items.slice(0, options.limit) : items,
    lastKey: expenses.lastKey || settlements.lastKey,
    hasMore: expenses.hasMore || settlements.hasMore,
  };
}

export async function getUserSummary(telegramId: number): Promise<UserExpenseSummary> {
  const [expensesPaid, expensesOwed, settlements, memberships] = await Promise.all([
    getAllExpensesPaidByUser(telegramId),
    getAllExpensesOwedByUser(telegramId),
    getAllSettlementsByUser(telegramId),
    getGroupsByUser(telegramId),
  ]);

  const totalPaid = expensesPaid.reduce((sum, e) => sum + e.amount, 0);
  const totalOwed = expensesOwed.reduce((sum, e) => sum + e.amount, 0);
  const settledAmount = settlements.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.amount, 0);

  return {
    totalPaid,
    totalOwed,
    netBalance: totalPaid - totalOwed + settledAmount,
    expensesPaidCount: expensesPaid.length,
    expensesOwedCount: expensesOwed.length,
    settlementsCount: settlements.length,
    groupCount: memberships.length,
  };
}

async function getAllExpensesPaidByUser(telegramId: number): Promise<ExpenseRecord[]> {
  const result = await getExpensesPaidByUser(telegramId);
  return result.items;
}

async function getAllExpensesOwedByUser(telegramId: number): Promise<ExpenseParticipantRecord[]> {
  const result = await getExpensesOwedByUser(telegramId);
  return result.items;
}

async function getAllSettlementsByUser(telegramId: number): Promise<SettlementRecord[]> {
  const result = await getSettlementsByUser(telegramId);
  return result.items;
}

export async function batchCreateExpenses(expenses: CreateExpenseInput[]): Promise<void> {
  if (expenses.length === 0) return;

  for (const expense of expenses) {
    await createExpense(expense);
  }
}

// ============================================
// Additional Operations (for server compatibility)
// ============================================

export async function getGroupByChatId(chatId: string): Promise<GroupRecord | null> {
  const { data } = await db.entities.group.query.byChat({ chatId }).go();

  return data[0] ? toGroupRecord(data[0]) : null;
}

export async function updateGroupMemberCount(groupId: string, count: number): Promise<void> {
  await db.entities.group.patch({ id: groupId }).set({ memberCount: count }).go();
}

export async function updateGroupCurrency(groupId: string, currency: string): Promise<void> {
  await db.entities.group.patch({ id: groupId }).set({ currency }).go();
}

export async function updateUserAvatar(groupId: string, telegramId: number, avatarUrl: string): Promise<void> {
  await db.entities.member.patch({ groupId, telegramId }).set({ avatarUrl }).go();
}

export async function getExpenseCount(groupId: string): Promise<number> {
  const { data } = await db.entities.expense.query.primary({ groupId }).go();

  return data.length;
}

// ============================================
// TON Connect Session Storage
// ============================================

export interface TonConnectSession {
  [key: string]: string;
}

export async function saveTonConnectSession(
  telegramId: number,
  sessionData: TonConnectSession
): Promise<void> {
  await db.entities.userSession.upsert({
    telegramId,
    tonConnectSession: JSON.stringify(sessionData),
    updatedAt: new Date().toISOString(),
  }).go();
}

export async function getTonConnectSession(
  telegramId: number
): Promise<TonConnectSession | null> {
  const { data } = await db.entities.userSession.get({ telegramId }).go();

  if (!data?.tonConnectSession) return null;

  try {
    return JSON.parse(data.tonConnectSession);
  } catch {
    return null;
  }
}

export async function deleteTonConnectSession(telegramId: number): Promise<void> {
  // Only clear the tonConnectSession field, preserve other user session data (like language)
  await db.entities.userSession.patch({ telegramId }).set({ tonConnectSession: undefined }).go();
}

// ============================================
// User Language Preference
// ============================================

export type SupportedLanguage = 'en' | 'ru';

export async function getUserLanguage(telegramId: number): Promise<SupportedLanguage | null> {
  const { data } = await db.entities.userSession.get({ telegramId }).go();

  if (!data?.languageCode) return null;

  return data.languageCode as SupportedLanguage;
}

export async function setUserLanguage(telegramId: number, languageCode: SupportedLanguage): Promise<void> {
  await db.entities.userSession.upsert({
    telegramId,
    languageCode,
    updatedAt: new Date().toISOString(),
  }).go();
}
