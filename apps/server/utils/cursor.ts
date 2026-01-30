/**
 * Cursor encoding/decoding utilities for pagination
 */

/**
 * Decode a base64url cursor to DynamoDB LastEvaluatedKey
 */
export function decodeCursor(cursor: string | undefined): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  } catch {
    return undefined;
  }
}

/**
 * Encode DynamoDB LastEvaluatedKey to a base64url cursor
 */
export function encodeCursor(lastKey: Record<string, unknown> | undefined): string | undefined {
  if (!lastKey) return undefined;

  return Buffer.from(JSON.stringify(lastKey)).toString('base64url');
}
