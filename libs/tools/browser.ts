import type { MemberRecord } from '@libs/types';

/**
 * Extract JSON from text that may contain other content.
 * Uses balanced brace matching to handle nested objects correctly.
 * Browser-compatible version.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function extractJSON<T>(text: string): T | null {
  const startIndex = text.indexOf('{');
  if (startIndex === -1) return null;

  let depth = 0;
  let endIndex = -1;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) return null;

  const jsonStr = text.slice(startIndex, endIndex + 1);

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Create a Map of member ID to member record for quick lookups
 */
export function createMemberMap(members: MemberRecord[]): Map<string, MemberRecord> {
  return new Map(members.map((m) => [m.id, m]));
}

/**
 * Create a Map of username (lowercase) to member record
 */
export function createUsernameMemberMap(members: MemberRecord[]): Map<string, MemberRecord> {
  // Safe to use non-null assertion because we filter for members with username
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return new Map(members.filter((m) => m.username).map((m) => [m.username!.toLowerCase(), m]));
}

/**
 * Safe number parsing with bounds checking
 */
export function safeParseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER) {
      return null;
    }

    return parsed;
  }

  return null;
}

/**
 * Format amount to fixed decimal places
 */
export function formatAmount(amount: number, decimals = 2): string {
  return amount.toFixed(decimals);
}

/**
 * Validate TON wallet address format
 */
export function isValidTonAddress(address: string): boolean {
  return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(address);
}

/**
 * Validate base64 string and check max size
 */
export function isValidBase64(str: string, maxSizeBytes?: number): boolean {
  if (!/^[A-Za-z0-9+/=]+$/.test(str)) {
    return false;
  }

  if (str.length % 4 !== 0) {
    return false;
  }

  if (maxSizeBytes !== undefined) {
    const estimatedBytes = (str.length * 3) / 4;
    if (estimatedBytes > maxSizeBytes) {
      return false;
    }
  }

  return true;
}

/**
 * Paginate an array
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; hasMore: boolean; total: number } {
  const start = page * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return {
    items: paginatedItems,
    hasMore: start + pageSize < items.length,
    total: items.length,
  };
}

/**
 * Decode a base64 cursor to DynamoDB LastEvaluatedKey
 */
export function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return undefined;
  }
}

/**
 * Encode DynamoDB LastEvaluatedKey to a base64 cursor
 */
export function encodeCursor(lastKey: Record<string, unknown> | undefined): string | undefined {
  if (!lastKey) return undefined;

  return btoa(JSON.stringify(lastKey)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a random UUID (browser-compatible)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
}
