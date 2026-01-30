import { randomUUID } from 'crypto';
import { createExpense, getGroupMembers } from '@libs/db';
import type { GroupRecord, MemberRecord } from '@libs/types';

/**
 * Expense Service - handles expense creation and splitting
 */

export interface ExpenseInput {
  groupId: string;
  group: GroupRecord;
  payerId: string;
  payerName: string;
  amount: number;
  description: string;
  beneficiaries?: string[];
  category?: string;
}

export interface ExpenseSplit {
  userId: string;
  userName: string;
  username?: string;
  telegramId?: number;
  amount: number;
}

export async function createExpenseFromParsed(input: ExpenseInput): Promise<{
  expense: Awaited<ReturnType<typeof createExpense>>;
  splits: ExpenseSplit[];
}> {
  const { groupId, group, payerId, payerName, amount, description, beneficiaries, category } = input;

  const members = await getGroupMembers(groupId);
  const memberMap = new Map<string, MemberRecord>(members.map((m) => [m.username?.toLowerCase() ?? '', m]));

  let splits: ExpenseSplit[];

  if (beneficiaries?.length) {
    // Split among specific beneficiaries (payer + mentioned names)
    const beneficiaryIds = new Set<string>([payerId]);
    for (const name of beneficiaries) {
      const member = memberMap.get(name.toLowerCase().replace('@', ''));
      if (member) beneficiaryIds.add(member.id);
    }

    const splitAmount = amount / beneficiaryIds.size;
    splits = Array.from(beneficiaryIds).map((id) => {
      const member = members.find((m) => m.id === id);

      return {
        userId: id,
        userName: member?.name || 'Unknown',
        username: member?.username,
        telegramId: member?.telegramId,
        amount: splitAmount,
      };
    });
  } else {
    // Solo expense - no beneficiaries mentioned, only payer is involved
    const payer = members.find((m) => m.id === payerId);
    splits = [{ userId: payerId, userName: payerName, username: payer?.username, telegramId: payer?.telegramId, amount }];
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
    category: category || 'other',
    splitType: 'equal',
    splits,
    createdAt: new Date().toISOString(),
  });

  return { expense, splits };
}

export interface PayerInfo {
  payerId: string;
  payerName: string;
  payerUsername?: string;
  payerTelegramId?: number;
}

export function findPayerFromMembers(
  payerName: string | null | undefined,
  members: MemberRecord[],
  defaultPayerId: string,
  defaultPayerName: string,
  defaultPayerUsername?: string,
  defaultPayerTelegramId?: number,
): PayerInfo {
  if (!payerName) {
    return { payerId: defaultPayerId, payerName: defaultPayerName, payerUsername: defaultPayerUsername, payerTelegramId: defaultPayerTelegramId };
  }

  const memberMap = new Map<string, MemberRecord>(members.map((m) => [m.username?.toLowerCase() ?? '', m]));

  const payerMember = memberMap.get(payerName.toLowerCase().replace('@', ''));
  if (payerMember) {
    return { payerId: payerMember.id, payerName: payerMember.name, payerUsername: payerMember.username, payerTelegramId: payerMember.telegramId };
  }

  return { payerId: defaultPayerId, payerName: defaultPayerName, payerUsername: defaultPayerUsername, payerTelegramId: defaultPayerTelegramId };
}
