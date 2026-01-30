import { Entity } from 'electrodb';

export const ExpenseParticipantEntity = new Entity({
  model: {
    entity: 'expenseParticipant',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    expenseId: { type: 'string', required: true },
    groupId: { type: 'string', required: true },
    groupTitle: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    userName: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    payerId: { type: 'string', required: true },
    payerName: { type: 'string', required: true },
    description: { type: 'string', required: true },
    totalAmount: { type: 'number', required: true },
    createdAt: { type: 'string', required: true },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'SK', composite: ['expenseId', 'userId'], template: 'PART#${expenseId}#${userId}' },
    },
    byUser: {
      index: 'GSI1',
      pk: { field: 'GSI1PK', composite: ['userId'], template: 'USER#${userId}' },
      sk: { field: 'GSI1SK', composite: ['createdAt', 'expenseId'], template: 'TX#${createdAt}#${expenseId}' },
    },
  },
});

export type ExpenseParticipantEntityType = typeof ExpenseParticipantEntity;
