import { DefaultCurrency } from '@libs/types';
import { Entity } from 'electrodb';

export const ExpenseEntity = new Entity({
  model: {
    entity: 'expense',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    id: { type: 'string', required: true },
    groupId: { type: 'string', required: true },
    payerId: { type: 'string', required: true },
    payerName: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    currency: { type: 'string', default: DefaultCurrency },
    description: { type: 'string', required: true },
    splitType: { type: ['equal', 'exact', 'percentage'] as const, required: true },
    splits: {
      type: 'list',
      items: {
        type: 'map',
        properties: {
          userId: { type: 'string', required: true },
          userName: { type: 'string', required: true },
          amount: { type: 'number', required: true },
          percentage: { type: 'number' },
        },
      },
    },
    category: { type: 'string' },
    createdAt: { type: 'string', required: true },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'SK', composite: ['createdAt'], template: 'TX#${createdAt}' },
    },
    byDate: {
      index: 'GSI2',
      pk: { field: 'GSI2PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'GSI2SK', composite: ['createdAt', 'id'], template: 'TX#${createdAt}#${id}' },
    },
    byPayer: {
      index: 'GSI3',
      pk: { field: 'GSI3PK', composite: ['payerId'], template: 'USER#${payerId}' },
      sk: { field: 'GSI3SK', composite: ['createdAt', 'id'], template: 'TX#${createdAt}#${id}' },
    },
  },
});

export type ExpenseEntityType = typeof ExpenseEntity;
