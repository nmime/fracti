import { Entity } from 'electrodb';

export const MemberEntity = new Entity({
  model: {
    entity: 'member',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    id: { type: 'string', required: true },
    groupId: { type: 'string', required: true },
    telegramId: { type: 'number', required: true },
    name: { type: 'string', required: true },
    username: { type: 'string' },
    wallet: { type: 'string' },
    avatarUrl: { type: 'string' },
    joinedAt: { type: 'string' },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['groupId'], template: 'GROUP#${groupId}' },
      sk: { field: 'SK', composite: ['telegramId'], template: 'USER#${telegramId}' },
    },
    byUser: {
      index: 'GSI1',
      pk: { field: 'GSI1PK', composite: ['telegramId'], template: 'USER#${telegramId}' },
      sk: { field: 'GSI1SK', composite: ['groupId'], template: 'GROUP#${groupId}' },
    },
  },
});

export type MemberEntityType = typeof MemberEntity;
