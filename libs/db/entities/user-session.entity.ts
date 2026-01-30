import { Entity } from 'electrodb';

/**
 * User Session Entity - stores global user data like TON Connect session and preferences
 * This allows persistence across devices
 */
export const UserSessionEntity = new Entity({
  model: {
    entity: 'userSession',
    version: '1',
    service: 'fracti',
  },
  attributes: {
    telegramId: { type: 'number', required: true },
    tonConnectSession: { type: 'string' }, // JSON-encoded session data
    wallet: { type: 'string' },
    languageCode: { type: 'string' }, // User's preferred language (en, ru)
    updatedAt: { type: 'string' },
  },
  indexes: {
    primary: {
      pk: { field: 'PK', composite: ['telegramId'], template: 'USER#${telegramId}' },
      sk: { field: 'SK', composite: [], template: 'SESSION' },
    },
  },
});

export type UserSessionEntityType = typeof UserSessionEntity;
