import type { IStorage } from '@tonconnect/sdk';
import { api } from '../services/api';
import { logger } from './logger';

const STORAGE_KEY_PREFIX = 'ton-connect-storage_';
const BACKEND_SYNC_KEYS = ['bridge-connection', 'last-selected-wallet'];

/**
 * Custom storage adapter for TON Connect that syncs session to backend
 * This enables wallet persistence across devices
 *
 * How it works:
 * 1. All data is stored in localStorage (fast, synchronous reads for TonConnect)
 * 2. Important keys are also synced to backend for cross-device persistence
 * 3. When a user authenticates, we restore from backend to localStorage
 */
export class TonConnectBackendStorage implements IStorage {
  private userId: number | null = null;
  private restorePromise: Promise<void> | null = null;

  /**
   * Set the user ID and trigger backend restore
   * Call this when user authenticates
   */
  setUserId(userId: number | null) {
    const previousUserId = this.userId;
    this.userId = userId;

    // Restore from backend when user authenticates (new device scenario)
    if (userId && !previousUserId && api.hasAuth()) {
      this.restorePromise = this.restoreFromBackend();
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    // Wait for any pending restore to complete first
    if (this.restorePromise) {
      await this.restorePromise;
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_PREFIX + key, value);

    // Sync important keys to backend for cross-device persistence
    if (this.shouldSyncKey(key) && this.userId && api.hasAuth()) {
      // Fire and forget - don't block the UI
      this.syncToBackend(key, value);
    }
  }

  async getItem(key: string): Promise<string | null> {
    // Wait for any pending restore to complete first
    if (this.restorePromise) {
      await this.restorePromise;
    }

    return localStorage.getItem(STORAGE_KEY_PREFIX + key);
  }

  async removeItem(key: string): Promise<void> {
    // Wait for any pending restore to complete first
    if (this.restorePromise) {
      await this.restorePromise;
    }

    localStorage.removeItem(STORAGE_KEY_PREFIX + key);

    // Also remove from backend
    if (this.shouldSyncKey(key) && this.userId && api.hasAuth()) {
      this.syncToBackend(key, '');
    }
  }

  private shouldSyncKey(key: string): boolean {
    return BACKEND_SYNC_KEYS.some((k) => key.includes(k));
  }

  private async syncToBackend(key: string, value: string): Promise<void> {
    try {
      await api.saveTonConnectSession({ key, value });
      logger.debug('TON Connect session synced to backend', { key });
    } catch (error) {
      logger.error('Failed to sync TON Connect session', { key }, error as Error);
    }
  }

  private async restoreFromBackend(): Promise<void> {
    try {
      const session = await api.getTonConnectSession();
      if (session && Object.keys(session).length > 0) {
        for (const [key, value] of Object.entries(session)) {
          if (value) {
            localStorage.setItem(STORAGE_KEY_PREFIX + key, value);
          }
        }
        logger.info('TON Connect session restored from backend');
      }
    } catch (error) {
      logger.debug('No TON Connect session on backend');
    } finally {
      this.restorePromise = null;
    }
  }
}

// Singleton instance
export const tonConnectStorage = new TonConnectBackendStorage();
