import { apiConfig } from '../config';

/**
 * API Client Service with JWT Authentication
 */

const API_BASE = apiConfig.baseUrl;
const TOKEN_KEY = 'fracti_jwt_token';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
}

// Auth types
export interface AuthUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  authMethod: 'init_data' | 'widget' | 'jwt';
  authenticated: boolean;
}

export interface VerifyAuthResponse {
  user: AuthUser;
  wallet: string | null;
  authMethod: 'init_data' | 'widget' | 'jwt';
  authenticated: boolean;
}

export interface TelegramWidgetData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken() {
    if (typeof window === 'undefined') return;
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  hasAuth(): boolean {
    return !!this.token;
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, signal, timeout = 30000 } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    const fetchSignal = signal || controller.signal;

    const authHeaders: Record<string, string> = {};
    if (this.token) {
      authHeaders.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: fetchSignal,
      });

      const json = (await response.json()) as ApiResponse<T>;

      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error || `HTTP ${response.status}`);
      }

      return json.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Auth endpoints
  async loginWithInitData(initData: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/init-data', {
      method: 'POST',
      body: { initData },
    });

    this.setToken(response.token);

    return response;
  }

  async loginWithWidget(widgetData: TelegramWidgetData): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/telegram-widget', {
      method: 'POST',
      body: widgetData,
    });

    this.setToken(response.token);

    return response;
  }

  async verifyAuth(): Promise<VerifyAuthResponse> {
    return this.request<VerifyAuthResponse>('/auth/me');
  }

  // Groups
  async getGroup(groupId: string) {
    return this.request<GroupWithMembers>(`/groups/${groupId}`);
  }

  async getGroups() {
    return this.request<Group[]>('/groups');
  }

  async createGroup(data: { title: string; chatId: string }) {
    return this.request<Group>('/groups', { method: 'POST', body: data });
  }

  async joinGroup(groupId: string, wallet?: string) {
    return this.request<{ success: true }>(`/groups/${groupId}/join`, {
      method: 'POST',
      body: { wallet },
    });
  }

  // Expenses
  async getExpenses(groupId: string) {
    return this.request<Expense[]>(`/groups/${groupId}/expenses`);
  }

  async createExpense(groupId: string, data: CreateExpenseInput) {
    return this.request<Expense>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: data,
    });
  }

  async deleteExpense(groupId: string, expenseId: string) {
    return this.request<{ success: true }>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    });
  }

  // AI Parsing
  async parseText(text: string, context?: { members?: string[]; groupId?: string }) {
    const response = await this.request<{ expense: ParsedExpense }>('/ai/parse', {
      method: 'POST',
      body: { text, context },
    });

    return response.expense;
  }

  async parseReceipt(imageBase64: string, mimeType = 'image/jpeg') {
    const response = await this.request<{ receipt: ParsedReceipt }>('/ai/vision', {
      method: 'POST',
      body: { image: imageBase64, mimeType },
    });

    return response.receipt;
  }

  // Debts & Settlements
  async getDebts(groupId: string) {
    return this.request<DebtData>(`/groups/${groupId}/debts`);
  }

  async getSettlements(groupId: string) {
    return this.request<Settlement[]>(`/groups/${groupId}/settlements`);
  }

  async recordSettlement(groupId: string, data: RecordSettlementInput) {
    return this.request<Settlement>(`/groups/${groupId}/settlements`, {
      method: 'POST',
      body: data,
    });
  }

  async confirmSettlement(groupId: string, settlementId: string, txHash: string) {
    return this.request<Settlement>(`/groups/${groupId}/settlements/${settlementId}`, {
      method: 'PUT',
      body: { txHash, status: 'completed' },
    });
  }

  // Users
  async updateUserWallet(groupId: string, wallet: string) {
    return this.request<{ wallet: string }>(`/groups/${groupId}/wallet`, {
      method: 'PUT',
      body: { wallet },
    });
  }

  async getCurrentUser() {
    return this.request<UserProfile>('/users/me');
  }

  async getUserGroups() {
    return this.request<UserGroup[]>('/users/me/groups');
  }

  async getUserExpenses(limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const query = params.toString() ? `?${params}` : '';

    return this.request<UserExpense[]>(`/users/me/expenses${query}`);
  }

  async getUserDebts() {
    return this.request<UserDebtSummary>('/users/me/debts');
  }

  async getUserSettlements(limit?: number) {
    const params = limit ? `?limit=${limit}` : '';

    return this.request<UserSettlement[]>(`/users/me/settlements${params}`);
  }

  async getUserActivity(limit?: number) {
    const params = limit ? `?limit=${limit}` : '';

    return this.request<UserActivityItem[]>(`/users/me/activity${params}`);
  }

  async getUserSummary() {
    return this.request<UserSummary>('/users/me/summary');
  }

  async getUserLanguage() {
    return this.request<{ languageCode: 'en' | 'ru' }>('/users/me/language');
  }

  async setUserLanguage(languageCode: 'en' | 'ru') {
    return this.request<{ languageCode: 'en' | 'ru' }>('/users/me/language', {
      method: 'PUT',
      body: { languageCode },
    });
  }

  // Analytics
  async getGroupAnalytics(groupId: string) {
    return this.request<GroupAnalytics>(`/groups/${groupId}/analytics`);
  }

  async getGroupReport(groupId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString() ? `?${params}` : '';

    return this.request<ExpenseReportRow[]>(`/groups/${groupId}/report${query}`);
  }

  async exportGroupData(
    groupId: string,
    format: 'csv' | 'html' = 'csv',
    type: 'expenses' | 'settlements' | 'full' = 'full',
    startDate?: string,
    endDate?: string,
  ): Promise<Blob> {
    const params = new URLSearchParams({ format, type });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/groups/${groupId}/export?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    return response.blob();
  }

  // Recurring Templates
  async getRecurringTemplates(groupId: string) {
    return this.request<RecurringTemplate[]>(`/groups/${groupId}/recurring`);
  }

  async getRecurringTemplate(groupId: string, templateId: string) {
    return this.request<RecurringTemplate>(`/groups/${groupId}/recurring/${templateId}`);
  }

  async createRecurringTemplate(groupId: string, data: CreateRecurringInput) {
    return this.request<RecurringTemplate>(`/groups/${groupId}/recurring`, {
      method: 'POST',
      body: data,
    });
  }

  async deleteRecurringTemplate(groupId: string, templateId: string) {
    return this.request<{ success: true }>(`/groups/${groupId}/recurring/${templateId}`, {
      method: 'DELETE',
    });
  }

  // Currency
  async convertCurrency(amount: number, from: string, to: string) {
    const params = new URLSearchParams({ amount: String(amount), from, to });

    return this.request<CurrencyConversion>(`/currency/convert?${params}`);
  }

  async getExchangeRates(base?: string) {
    const params = base ? `?base=${base}` : '';

    return this.request<ExchangeRates>(`/currency/rates${params}`);
  }

  async getSupportedCurrencies() {
    return this.request<SupportedCurrency[]>('/currency/supported');
  }

  // TON Connect Session (for cross-device persistence)
  async saveTonConnectSession(data: { key: string; value: string }) {
    return this.request<{ success: boolean }>('/ton-proof/session', {
      method: 'POST',
      body: data,
    });
  }

  async getTonConnectSession(): Promise<Record<string, string> | null> {
    try {
      const response = await this.request<{ session: Record<string, string> }>('/ton-proof/session');
      return response.session || null;
    } catch {
      return null;
    }
  }

  async deleteTonConnectSession() {
    return this.request<{ success: boolean }>('/ton-proof/session', {
      method: 'DELETE',
    });
  }
}

// Types
export interface Group {
  id: string;
  chatId: string;
  title: string;
  currency?: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupWithMembers extends Group {
  members: User[];
}

export interface User {
  id: string;
  telegramId: number;
  name: string;
  username?: string;
  wallet?: string;
  avatarUrl?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  createdAt: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  amount: number;
  percentage?: number;
}

export interface CreateExpenseInput {
  payerId: string;
  amount: number;
  description: string;
  splitType?: 'equal' | 'exact' | 'percentage';
  splits: { userId: string; amount?: number }[];
}

export interface ParsedExpense {
  payer: string | null;
  amount: number;
  currency: string;
  description: string;
  beneficiaries: string[];
  splitType: string;
  confidence: number;
}

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  confidence: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface DebtData {
  graph: DebtGraph;
  suggestedSettlements: SuggestedSettlement[];
  balances: DebtNode[];
  summary: {
    totalExpenses: number;
    totalSettled: number;
    expenseCount: number;
    settlementCount: number;
    pendingSettlements: number;
  };
}

export interface DebtGraph {
  nodes: DebtNode[];
  edges: DebtEdge[];
}

export interface DebtNode {
  id: string;
  name: string;
  balance: number;
  wallet?: string;
}

export interface DebtEdge {
  from: string;
  to: string;
  amount: number;
}

export interface SuggestedSettlement {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface RecordSettlementInput {
  toId: string;
  amount: number;
  txHash?: string;
  recipientWallet?: string;
  paymentType?: 'TON' | 'USDT';
}

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  groupCount: number;
  createdAt: string;
}

export interface UserGroup {
  id: string;
  title: string;
  chatId: string;
  memberCount: number;
  currency?: string;
  joinedAt: string;
  balance: number;
  expenseCount: number;
}

export interface UserExpense {
  id: string;
  groupId: string;
  groupTitle: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  description: string;
  yourShare: number;
  createdAt: string;
}

export interface UserDebtSummary {
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  byGroup: {
    groupId: string;
    groupTitle: string;
    balance: number;
  }[];
  owedTo: {
    userId: string;
    userName: string;
    amount: number;
  }[];
  owingFrom: {
    userId: string;
    userName: string;
    amount: number;
  }[];
}

export interface UserSettlement {
  id: string;
  groupId: string;
  groupTitle: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
}

export interface UserActivityItem {
  id: string;
  type: 'expense_paid' | 'expense_received' | 'settlement_sent' | 'settlement_received';
  groupId: string;
  groupTitle: string;
  description: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface UserSummary {
  totalPaid: number;
  totalReceived: number;
  totalSettlementsSent: number;
  totalSettlementsReceived: number;
  expenseCount: number;
  settlementCount: number;
  groupCount: number;
  mostActiveGroup?: {
    id: string;
    title: string;
    expenseCount: number;
  };
  topCategory?: {
    name: string;
    amount: number;
  };
}

export interface GroupAnalytics {
  groupId: string;
  groupTitle: string;
  currency: string;
  totalExpenses: number;
  expenseCount: number;
  settlementCount: number;
  totalSettled: number;
  averageExpense: number;
  memberStats: {
    id: string;
    name: string;
    totalPaid: number;
    totalOwed: number;
    balance: number;
  }[];
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
    count: number;
  }[];
  topExpenses: {
    id: string;
    description: string;
    amount: number;
    date: string;
  }[];
}

export interface ExpenseReportRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  payer: string;
  category: string;
  splitWith: string;
  yourShare: number;
}

export interface RecurringTemplate {
  id: string;
  groupId: string;
  name: string;
  payerId: string;
  payerName: string;
  amount: number;
  currency: string;
  description: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splits: ExpenseSplit[];
  category?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  lastRun?: string;
  nextRun: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface CreateRecurringInput {
  name: string;
  payerId: string;
  amount: number;
  currency?: string;
  description: string;
  splitType?: 'equal' | 'exact' | 'percentage';
  splits: { userId: string; amount?: number; percentage?: number }[];
  category?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  startDate?: string;
}

export interface CurrencyConversion {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  timestamp: string;
}

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: string;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  type: 'fiat' | 'crypto';
}

export const api = new ApiClient(API_BASE);
