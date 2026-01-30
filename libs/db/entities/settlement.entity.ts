import { DefaultCurrency } from '@libs/types';
import { Entity } from 'electrodb';

export const SettlementEntity = new Entity({
  model: {
    entity: 'settlement',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    id: { type: 'string', required: true },
    groupId: { type: 'string', required: true },
    fromUserId: { type: 'string', required: true },
    fromUserName: { type: 'string', required: true },
    toUserId: { type: 'string', required: true },
    toUserName: { type: 'string', required: true },
    amount: { type: 'number', required: true },
    currency: { type: 'string', default: DefaultCurrency },
    txHash: { type: 'string' },
    status: { type: ['pending', 'completed', 'failed'] as const, required: true },
    createdAt: { type: 'string', required: true },
    completedAt: { type: 'string' },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'SK', composite: ['createdAt'], template: 'SETTLE#${createdAt}' },
    },
    byDate: {
      index: 'GSI2',
      pk: { field: 'GSI2PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'GSI2SK', composite: ['createdAt', 'id'], template: 'SETTLE#${createdAt}#${id}' },
    },
    byFromUser: {
      index: 'GSI3',
      pk: { field: 'GSI3PK', composite: ['fromUserId'], template: 'USER#${fromUserId}' },
      sk: { field: 'GSI3SK', composite: ['createdAt', 'id'], template: 'SETTLE#${createdAt}#${id}' },
    },
  },
});

export type SettlementEntityType = typeof SettlementEntity;
