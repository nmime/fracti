import { DefaultCurrency } from '@libs/types';
import { Entity } from 'electrodb';

export const GroupEntity = new Entity({
  model: {
    entity: 'group',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    id: { type: 'string', required: true },
    chatId: { type: 'string', required: true },
    title: { type: 'string', required: true },
    currency: { type: 'string', default: DefaultCurrency },
    memberCount: { type: 'number', default: 0 },
    createdAt: { type: 'string', required: true },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['id'], template: 'GROUP#${id}' },
      sk: { field: 'SK', composite: [], template: 'METADATA' },
    },
    byChat: {
      index: 'GSI1',
      pk: { field: 'GSI1PK', composite: ['chatId'], template: 'CHAT#${chatId}' },
      sk: { field: 'GSI1SK', composite: ['id'], template: 'GROUP#${id}' },
    },
  },
});

export type GroupEntityType = typeof GroupEntity;
