import type { SessionData } from './types';

/**
 * Client-side session utilities
 */

const SESSION_STORAGE_KEY = 'fracti_session';

export function getClientSession(): SessionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as SessionData;

    // Check expiration
    if (session.expiresAt && Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);

      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function setClientSession(session: SessionData): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

export function clearClientSession(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function isSessionValid(session: SessionData | null): boolean {
  if (!session) return false;
  if (!session.expiresAt) return true;

  return Date.now() < session.expiresAt;
}
