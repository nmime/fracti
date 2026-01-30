import type { MemberRecord } from '@libs/types';
import type { ZodType } from 'zod';

/**
 * Extract JSON from text that may contain other content.
 * Uses balanced brace matching to handle nested objects correctly.
 * Useful for parsing AI responses that include JSON in markdown or prose.
 */
export function extractJSON<T>(text: string, schema?: ZodType<T>): T | null {
  // Find the first { and attempt to find its matching }
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
    const parsed = JSON.parse(jsonStr);

    return schema ? schema.parse(parsed) : parsed;
  } catch {
    return null;
  }
}

/**
 * Extract JSON with error throwing
 */
export function extractJSONOrThrow<T>(text: string, schema?: ZodType<T>): T {
  const result = extractJSON<T>(text, schema);
  if (result === null) {
    throw new Error('Failed to extract valid JSON from text');
  }

  return result;
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
  // TON addresses are base64url encoded, 48 characters after prefix
  return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(address);
}

/**
 * Validate base64 string and check max size
 */
export function isValidBase64(str: string, maxSizeBytes?: number): boolean {
  // Check base64 format
  if (!/^[A-Za-z0-9+/=]+$/.test(str)) {
    return false;
  }

  // Check padding
  if (str.length % 4 !== 0) {
    return false;
  }

  // Check size if specified
  if (maxSizeBytes !== undefined) {
    // Base64 encodes 3 bytes in 4 characters
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
