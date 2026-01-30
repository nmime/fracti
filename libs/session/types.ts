import type { TelegramUser } from '@libs/types';

export interface SessionData {
  user: TelegramUser;
  groupId?: string;
  initData: string;
  initDataHash: string;
  expiresAt: number;
}

export interface SessionStore {
  get(key: string): Promise<SessionData | null>;
  set(key: string, data: SessionData, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SessionConfig {
  secret: string;
  ttlSeconds: number;
  cookieName: string;
  secure: boolean;
}
