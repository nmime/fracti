import { randomUUID } from 'crypto'
import { createExpense, getGroupMembers } from '@core/db'
import type { GroupRecord, MemberRecord } from '@core/types'

/**
 * Expense Service - handles expense creation and splitting
 */

export interface ExpenseInput {
  groupId: string
  group: GroupRecord
  payerId: string
  payerName: string
  amount: number
  description: string
  beneficiaries?: string[]
}

export interface ExpenseSplit {
  userId: string
  userName: string
  amount: number
}

export async function createExpenseFromParsed(input: ExpenseInput): Promise<{
  expense: Awaited<ReturnType<typeof createExpense>>
  splits: ExpenseSplit[]
}> {
  const { groupId, group, payerId, payerName, amount, description, beneficiaries } = input

  const members = await getGroupMembers(groupId)
  const memberMap = new Map<string, MemberRecord>(
    members.map((m) => [m.username?.toLowerCase() ?? '', m])
  )

  let splits: ExpenseSplit[]

  if (beneficiaries?.length) {
    // Split among specific beneficiaries
    const beneficiaryIds = new Set<string>([payerId])
    for (const name of beneficiaries) {
      const member = memberMap.get(name.toLowerCase().replace('@', ''))
      if (member) beneficiaryIds.add(member.id)
    }
    const splitAmount = amount / beneficiaryIds.size
    splits = Array.from(beneficiaryIds).map((id) => {
      const member = members.find((m) => m.id === id)
      return { userId: id, userName: member?.name || 'Unknown', amount: splitAmount }
    })
  } else {
    // Split equally among all members
    splits = members.map((m) => ({
      userId: m.id,
      userName: m.name,
      amount: amount / members.length,
    }))
  }

  const expense = await createExpense({
    id: randomUUID(),
    groupId,
    groupTitle: group.title,
    payerId,
    payerName,
    amount,
    currency: group.currency,
    description,
    splitType: 'equal',
    splits,
    createdAt: new Date().toISOString(),
  })

  return { expense, splits }
}

export function findPayerFromMembers(
  payerName: string | null | undefined,
  members: MemberRecord[],
  defaultPayerId: string,
  defaultPayerName: string
): { payerId: string; payerName: string } {
  if (!payerName) {
    return { payerId: defaultPayerId, payerName: defaultPayerName }
  }

  const memberMap = new Map<string, MemberRecord>(
    members.map((m) => [m.username?.toLowerCase() ?? '', m])
  )

  const payerMember = memberMap.get(payerName.toLowerCase().replace('@', ''))
  if (payerMember) {
    return { payerId: payerMember.id, payerName: payerMember.name }
  }

  return { payerId: defaultPayerId, payerName: defaultPayerName }
}
