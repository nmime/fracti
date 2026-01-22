const API_BASE = import.meta.env.VITE_API_URL || '/api'

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

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Groups
  async getGroup(groupId: string) {
    return this.request<Group>(`/groups/${groupId}`)
  }

  async getGroups() {
    return this.request<Group[]>('/groups')
  }

  async createGroup(data: { title: string; chatId: string }) {
    return this.request<Group>('/groups', { method: 'POST', body: data })
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
    return this.request<void>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    })
  }

  // AI Parsing
  async parseMessage(message: string) {
    return this.request<ParsedExpense>('/ai/parse', {
      method: 'POST',
      body: { message },
    })
  }

  async parseReceipt(imageBase64: string) {
    return this.request<ParsedReceipt>('/ai/vision', {
      method: 'POST',
      body: { image: imageBase64 },
    })
  }

  // Settlements
  async getDebts(groupId: string) {
    return this.request<DebtGraph>(`/groups/${groupId}/debts`)
  }

  async getOptimizedSettlements(groupId: string) {
    return this.request<Settlement[]>(`/groups/${groupId}/settlements`)
  }

  async recordSettlement(groupId: string, data: RecordSettlementInput) {
    return this.request<Settlement>(`/groups/${groupId}/settlements`, {
      method: 'POST',
      body: data,
    })
  }

  // Users
  async updateUserWallet(groupId: string, wallet: string) {
    return this.request<User>(`/groups/${groupId}/wallet`, {
      method: 'PUT',
      body: { wallet },
    })
  }

  async getGroupMembers(groupId: string) {
    return this.request<User[]>(`/groups/${groupId}/members`)
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

export interface User {
  id: string
  telegramId: number
  name: string
  username?: string
  wallet?: string
  avatarUrl?: string
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
  splitType: 'equal' | 'exact' | 'percentage'
  splits: { userId: string; amount?: number; percentage?: number }[]
}

export interface ParsedExpense {
  payer?: string
  amount: number
  currency?: string
  description: string
  beneficiaries: string[]
  confidence: number
}

export interface ParsedReceipt {
  items: ReceiptItem[]
  total: number
  tax?: number
  currency?: string
  merchant?: string
  date?: string
  confidence: number
}

export interface ReceiptItem {
  name: string
  quantity: number
  price: number
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
  fromUserId: string
  toUserId: string
  amount: number
  txHash: string
}

export const api = new ApiClient(API_BASE)
