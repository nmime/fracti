import { apiConfig } from './config'

const API_BASE = apiConfig.baseUrl

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  message?: string
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

class ApiClient {
  private baseUrl: string
  private initData: string = ''

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setInitData(initData: string) {
    this.initData = initData
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Init-Data': this.initData,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const json = await response.json() as ApiResponse<T>

    if (!response.ok || !json.success) {
      throw new Error(json.message || json.error || `HTTP ${response.status}`)
    }

    return json.data
  }

  // Groups
  async getGroup(groupId: string) {
    return this.request<GroupWithMembers>(`/groups/${groupId}`)
  }

  async getGroups() {
    return this.request<Group[]>('/groups')
  }

  async createGroup(data: { title: string; chatId: string }) {
    return this.request<Group>('/groups', { method: 'POST', body: data })
  }

  async joinGroup(groupId: string, wallet?: string) {
    return this.request<{ success: true }>(`/groups/${groupId}/join`, {
      method: 'POST',
      body: { wallet },
    })
  }

  // Expenses
  async getExpenses(groupId: string) {
    return this.request<Expense[]>(`/groups/${groupId}/expenses`)
  }

  async createExpense(groupId: string, data: CreateExpenseInput) {
    return this.request<Expense>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: data,
    })
  }

  async deleteExpense(groupId: string, expenseId: string) {
    return this.request<{ success: true }>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    })
  }

  // AI Parsing
  async parseText(text: string, context?: { members?: string[]; groupId?: string }) {
    const response = await this.request<{ expense: ParsedExpense }>('/ai/parse', {
      method: 'POST',
      body: { text, context },
    })
    return response.expense
  }

  async parseReceipt(imageBase64: string, mimeType = 'image/jpeg') {
    const response = await this.request<{ receipt: ParsedReceipt }>('/ai/vision', {
      method: 'POST',
      body: { image: imageBase64, mimeType },
    })
    return response.receipt
  }

  // Debts & Settlements
  async getDebts(groupId: string) {
    return this.request<DebtData>(`/groups/${groupId}/debts`)
  }

  async getSettlements(groupId: string) {
    return this.request<Settlement[]>(`/groups/${groupId}/settlements`)
  }

  async recordSettlement(groupId: string, data: RecordSettlementInput) {
    return this.request<Settlement>(`/groups/${groupId}/settlements`, {
      method: 'POST',
      body: data,
    })
  }

  async confirmSettlement(groupId: string, settlementId: string, txHash: string) {
    return this.request<Settlement>(`/groups/${groupId}/settlements/${settlementId}`, {
      method: 'PUT',
      body: { txHash, status: 'completed' },
    })
  }

  // Users
  async updateUserWallet(groupId: string, wallet: string) {
    return this.request<{ wallet: string }>(`/groups/${groupId}/wallet`, {
      method: 'PUT',
      body: { wallet },
    })
  }
}

// Types
export interface Group {
  id: string
  chatId: string
  title: string
  createdAt: string
  memberCount: number
}

export interface GroupWithMembers extends Group {
  members: User[]
}

export interface User {
  id: string
  name: string
  username?: string
  wallet?: string
}

export interface Expense {
  id: string
  groupId: string
  payerId: string
  payerName: string
  amount: number
  description: string
  splitType: 'equal' | 'exact' | 'percentage'
  splits: ExpenseSplit[]
  createdAt: string
}

export interface ExpenseSplit {
  userId: string
  userName: string
  amount: number
  percentage?: number
}

export interface CreateExpenseInput {
  payerId: string
  amount: number
  description: string
  splitType?: 'equal' | 'exact' | 'percentage'
  splits: { userId: string; amount?: number }[]
}

export interface ParsedExpense {
  payer: string | null
  amount: number
  currency: string
  description: string
  beneficiaries: string[]
  splitType: string
  confidence: number
}

export interface ParsedReceipt {
  merchant: string | null
  date: string | null
  items: ReceiptItem[]
  subtotal: number
  tax: number
  total: number
  currency: string
  confidence: number
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
}

export interface DebtData {
  graph: DebtGraph
  suggestedSettlements: SuggestedSettlement[]
  balances: DebtNode[]
  summary: {
    totalExpenses: number
    totalSettled: number
    expenseCount: number
    settlementCount: number
    pendingSettlements: number
  }
}

export interface DebtGraph {
  nodes: DebtNode[]
  edges: DebtEdge[]
}

export interface DebtNode {
  id: string
  name: string
  balance: number
  wallet?: string
}

export interface DebtEdge {
  from: string
  to: string
  amount: number
}

export interface SuggestedSettlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

export interface Settlement {
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

export interface RecordSettlementInput {
  toId: string
  amount: number
  txHash?: string
}

export const api = new ApiClient(API_BASE)
