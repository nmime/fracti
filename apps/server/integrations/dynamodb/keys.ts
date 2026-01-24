/**
 * DynamoDB key builders for single-table design
 */

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
}

// GSI key prefixes
export const GSI_PREFIXES = {
  USER: 'USER#',
  GROUP: 'GROUP#',
  EXPENSE: 'EXPENSE#',
  SETTLEMENT: 'SETTLEMENT#',
  OWES: 'OWES#',
  TX: 'TX#',
  SETTLE: 'SETTLE#',
} as const
