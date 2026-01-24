import { randomUUID } from 'crypto'
import { settlementsRepository } from '../repositories/settlements.repository'
import { membersRepository } from '../repositories/members.repository'
import { expensesRepository } from '../repositories/expenses.repository'
import type {
  SettlementRecord,
  ExpenseRecord,
  MemberRecord,
  PaginationOptions,
  PaginatedResult,
} from '../types/db.types'
import { verifyTonTransaction, type VerificationResult } from '../integrations/ton'
import { createMemberMap } from '../utils'

// Debt calculation types
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

export interface DebtGraph {
  nodes: DebtNode[]
  edges: DebtEdge[]
}

export interface OptimizedSettlement {
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  amount: number
}

const BALANCE_THRESHOLD = 0.01

class SettlementsService {
  async getSettlementsByGroup(
    groupId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<SettlementRecord>> {
    return settlementsRepository.findByGroup(groupId, options)
  }

  async getAllSettlementsByGroup(groupId: string): Promise<SettlementRecord[]> {
    return settlementsRepository.findAllByGroup(groupId)
  }

  async getSettlementById(settlementId: string): Promise<SettlementRecord | null> {
    return settlementsRepository.findById(settlementId)
  }

  async createSettlement(
    groupId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency?: string,
    txHash?: string
  ): Promise<SettlementRecord> {
    const members = await membersRepository.findByGroup(groupId)
    const memberMap = createMemberMap(members)

    const fromUser = memberMap.get(fromUserId)
    const toUser = memberMap.get(toUserId)

    if (!fromUser || !toUser) {
      throw new Error('Settlement participants not found in group')
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    return settlementsRepository.create({
      id,
      groupId,
      fromUserId,
      fromUserName: fromUser.name,
      toUserId,
      toUserName: toUser.name,
      amount,
      currency,
      txHash,
      status: txHash ? 'pending' : 'pending',
      createdAt: now,
    })
  }

  async updateSettlementStatus(
    groupId: string,
    settlementId: string,
    status: SettlementRecord['status'],
    txHash?: string
  ): Promise<void> {
    const settlement = await settlementsRepository.findById(settlementId)

    if (!settlement) {
      throw new Error('Settlement not found')
    }

    if (settlement.groupId !== groupId) {
      throw new Error('Settlement not found in this group')
    }

    await settlementsRepository.updateStatus(groupId, settlement.createdAt, status, txHash)
  }

  async verifyPayment(
    groupId: string,
    settlementId: string,
    txHash: string
  ): Promise<VerificationResult> {
    const settlement = await settlementsRepository.findById(settlementId)

    if (!settlement) {
      throw new Error('Settlement not found')
    }

    if (settlement.groupId !== groupId) {
      throw new Error('Settlement not found in this group')
    }

    const members = await membersRepository.findByGroup(groupId)
    const memberMap = createMemberMap(members)
    const recipient = memberMap.get(settlement.toUserId)

    if (!recipient?.wallet) {
      throw new Error('Recipient wallet not found')
    }

    const result = await verifyTonTransaction(txHash, recipient.wallet, settlement.amount)

    if (result.verified) {
      await settlementsRepository.updateStatus(groupId, settlement.createdAt, 'completed', txHash)
    }

    return result
  }

  // Debt calculation methods
  async calculateDebts(groupId: string): Promise<OptimizedSettlement[]> {
    const [expenses, settlements, members] = await Promise.all([
      expensesRepository.findAllByGroup(groupId),
      settlementsRepository.findAllByGroup(groupId),
      membersRepository.findByGroup(groupId),
    ])

    const balances = this.calculateBalances(expenses, settlements, members)
    return this.optimizeSettlements(balances, members)
  }

  async getDebtGraph(groupId: string): Promise<DebtGraph> {
    const [expenses, settlements, members] = await Promise.all([
      expensesRepository.findAllByGroup(groupId),
      settlementsRepository.findAllByGroup(groupId),
      membersRepository.findByGroup(groupId),
    ])

    const balances = this.calculateBalances(expenses, settlements, members)
    return this.buildDebtGraph(balances, members)
  }

  private calculateBalances(
    expenses: ExpenseRecord[],
    settlements: SettlementRecord[],
    members: MemberRecord[]
  ): Map<string, number> {
    const balances = new Map<string, number>()

    for (const member of members) {
      balances.set(member.id, 0)
    }

    for (const expense of expenses) {
      const currentPayerBalance = balances.get(expense.payerId) || 0
      const payerSplit = expense.splits.find((s) => s.userId === expense.payerId)?.amount || 0
      balances.set(expense.payerId, currentPayerBalance + expense.amount - payerSplit)

      for (const split of expense.splits) {
        if (split.userId !== expense.payerId) {
          const currentBalance = balances.get(split.userId) || 0
          balances.set(split.userId, currentBalance - split.amount)
        }
      }
    }

    for (const settlement of settlements) {
      if (settlement.status === 'completed') {
        const fromBalance = balances.get(settlement.fromUserId) || 0
        balances.set(settlement.fromUserId, fromBalance + settlement.amount)

        const toBalance = balances.get(settlement.toUserId) || 0
        balances.set(settlement.toUserId, toBalance - settlement.amount)
      }
    }

    return balances
  }

  private buildDebtGraph(
    balances: Map<string, number>,
    members: MemberRecord[]
  ): DebtGraph {
    const memberMap = createMemberMap(members)

    const nodes: DebtNode[] = []
    const creditors: Array<{ id: string; amount: number }> = []
    const debtors: Array<{ id: string; amount: number }> = []

    for (const [userId, balance] of balances) {
      const member = memberMap.get(userId)
      if (!member) continue

      nodes.push({
        id: userId,
        name: member.name,
        balance: Math.round(balance * 100) / 100,
        wallet: member.wallet,
      })

      if (balance > BALANCE_THRESHOLD) {
        creditors.push({ id: userId, amount: balance })
      } else if (balance < -BALANCE_THRESHOLD) {
        debtors.push({ id: userId, amount: -balance })
      }
    }

    const edges: DebtEdge[] = []
    const debtorsCopy = [...debtors].sort((a, b) => b.amount - a.amount)
    const creditorsCopy = [...creditors].sort((a, b) => b.amount - a.amount)

    let i = 0
    let j = 0

    while (i < debtorsCopy.length && j < creditorsCopy.length) {
      const debtor = debtorsCopy[i]
      const creditor = creditorsCopy[j]

      const amount = Math.min(debtor.amount, creditor.amount)

      if (amount > BALANCE_THRESHOLD) {
        edges.push({
          from: debtor.id,
          to: creditor.id,
          amount: Math.round(amount * 100) / 100,
        })
      }

      debtor.amount -= amount
      creditor.amount -= amount

      if (debtor.amount < BALANCE_THRESHOLD) i++
      if (creditor.amount < BALANCE_THRESHOLD) j++
    }

    return { nodes, edges }
  }

  private optimizeSettlements(
    balances: Map<string, number>,
    members: MemberRecord[]
  ): OptimizedSettlement[] {
    const memberMap = createMemberMap(members)
    const settlements: OptimizedSettlement[] = []

    const creditors: Array<{ id: string; amount: number }> = []
    const debtors: Array<{ id: string; amount: number }> = []

    for (const [userId, balance] of balances) {
      if (balance > BALANCE_THRESHOLD) {
        creditors.push({ id: userId, amount: balance })
      } else if (balance < -BALANCE_THRESHOLD) {
        debtors.push({ id: userId, amount: -balance })
      }
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    let i = 0
    let j = 0

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]
      const creditor = creditors[j]
      const debtorMember = memberMap.get(debtor.id)
      const creditorMember = memberMap.get(creditor.id)

      if (!debtorMember || !creditorMember) {
        i++
        j++
        continue
      }

      const amount = Math.min(debtor.amount, creditor.amount)

      if (amount > BALANCE_THRESHOLD) {
        settlements.push({
          fromUserId: debtor.id,
          fromUserName: debtorMember.name,
          toUserId: creditor.id,
          toUserName: creditorMember.name,
          amount: Math.round(amount * 100) / 100,
        })
      }

      debtor.amount -= amount
      creditor.amount -= amount

      if (debtor.amount < BALANCE_THRESHOLD) i++
      if (creditor.amount < BALANCE_THRESHOLD) j++
    }

    return settlements
  }
}

export const settlementsService = new SettlementsService()
