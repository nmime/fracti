import type { ExpenseRecord, SettlementRecord, UserRecord } from './dynamodb'

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

/**
 * Calculate net balances for each user from expenses and settlements
 */
export function calculateBalances(
  expenses: ExpenseRecord[],
  settlements: SettlementRecord[],
  members: UserRecord[]
): Map<string, number> {
  const balances = new Map<string, number>()

  // Initialize all members with 0 balance
  for (const member of members) {
    balances.set(member.id, 0)
  }

  // Process expenses
  for (const expense of expenses) {
    // Payer is owed money (positive balance)
    const currentPayerBalance = balances.get(expense.payerId) || 0
    balances.set(
      expense.payerId,
      currentPayerBalance + expense.amount - (expense.splits.find(s => s.userId === expense.payerId)?.amount || 0)
    )

    // Each person in split owes money (negative balance)
    for (const split of expense.splits) {
      if (split.userId !== expense.payerId) {
        const currentBalance = balances.get(split.userId) || 0
        balances.set(split.userId, currentBalance - split.amount)
      }
    }
  }

  // Process completed settlements
  for (const settlement of settlements) {
    if (settlement.status === 'completed') {
      // Payer's debt decreases (balance goes up)
      const fromBalance = balances.get(settlement.fromUserId) || 0
      balances.set(settlement.fromUserId, fromBalance + settlement.amount)

      // Receiver's credit decreases (balance goes down)
      const toBalance = balances.get(settlement.toUserId) || 0
      balances.set(settlement.toUserId, toBalance - settlement.amount)
    }
  }

  return balances
}

/**
 * Build a debt graph from balances
 */
export function buildDebtGraph(
  balances: Map<string, number>,
  members: UserRecord[]
): DebtGraph {
  const memberMap = new Map(members.map((m) => [m.id, m]))

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

    if (balance > 0.01) {
      creditors.push({ id: userId, amount: balance })
    } else if (balance < -0.01) {
      debtors.push({ id: userId, amount: -balance })
    }
  }

  // Create edges from debtors to creditors
  const edges: DebtEdge[] = []
  const debtorsCopy = [...debtors].sort((a, b) => b.amount - a.amount)
  const creditorsCopy = [...creditors].sort((a, b) => b.amount - a.amount)

  let i = 0
  let j = 0

  while (i < debtorsCopy.length && j < creditorsCopy.length) {
    const debtor = debtorsCopy[i]
    const creditor = creditorsCopy[j]

    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0.01) {
      edges.push({
        from: debtor.id,
        to: creditor.id,
        amount: Math.round(amount * 100) / 100,
      })
    }

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount < 0.01) i++
    if (creditor.amount < 0.01) j++
  }

  return { nodes, edges }
}

/**
 * Min-Cash-Flow Algorithm
 * Optimizes the number of transactions needed to settle all debts
 */
export function optimizeSettlements(
  balances: Map<string, number>,
  members: UserRecord[]
): OptimizedSettlement[] {
  const memberMap = new Map(members.map((m) => [m.id, m]))
  const settlements: OptimizedSettlement[] = []

  // Separate creditors and debtors
  const creditors: Array<{ id: string; amount: number }> = []
  const debtors: Array<{ id: string; amount: number }> = []

  for (const [userId, balance] of balances) {
    if (balance > 0.01) {
      creditors.push({ id: userId, amount: balance })
    } else if (balance < -0.01) {
      debtors.push({ id: userId, amount: -balance })
    }
  }

  // Sort by amount descending for optimal matching
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  // Greedy matching
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

    if (amount > 0.01) {
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

    if (debtor.amount < 0.01) i++
    if (creditor.amount < 0.01) j++
  }

  return settlements
}

/**
 * Calculate what a specific user owes or is owed
 */
export function getUserDebts(
  userId: string,
  debtGraph: DebtGraph
): {
  owes: Array<{ to: string; toName: string; amount: number }>
  owed: Array<{ from: string; fromName: string; amount: number }>
  netBalance: number
} {
  const nodeMap = new Map(debtGraph.nodes.map((n) => [n.id, n]))
  const userNode = nodeMap.get(userId)

  const owes: Array<{ to: string; toName: string; amount: number }> = []
  const owed: Array<{ from: string; fromName: string; amount: number }> = []

  for (const edge of debtGraph.edges) {
    if (edge.from === userId) {
      const toNode = nodeMap.get(edge.to)
      if (toNode) {
        owes.push({
          to: edge.to,
          toName: toNode.name,
          amount: edge.amount,
        })
      }
    }
    if (edge.to === userId) {
      const fromNode = nodeMap.get(edge.from)
      if (fromNode) {
        owed.push({
          from: edge.from,
          fromName: fromNode.name,
          amount: edge.amount,
        })
      }
    }
  }

  return {
    owes,
    owed,
    netBalance: userNode?.balance ?? 0,
  }
}
