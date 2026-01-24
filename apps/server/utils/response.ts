import type { Context } from 'hono'
import type { ApiSuccess, ApiError, PaginatedApiResponse } from '../types/api.types'

/**
 * Create a success response
 */
export function success<T>(c: Context, data: T, status: 200 | 201 = 200) {
  const response: ApiSuccess<T> = {
    success: true,
    data,
    requestId: c.get('requestId'),
  }
  return c.json(response, status)
}

/**
 * Create a paginated success response
 */
export function paginated<T>(
  c: Context,
  data: T[],
  pagination: { hasMore: boolean; nextCursor?: string }
) {
  const response: PaginatedApiResponse<T> = {
    success: true,
    data,
    pagination,
    requestId: c.get('requestId'),
  }
  return c.json(response)
}

/**
 * Create an error response
 */
export function error(
  c: Context,
  message: string,
  status: 400 | 401 | 403 | 404 | 500 = 400,
  details?: unknown
) {
  const response: ApiError = {
    success: false,
    error: message,
    details,
    requestId: c.get('requestId'),
  }
  return c.json(response, status)
}

/**
 * Helper to create member map from array
 */
export function createMemberMap<T extends { id: string }>(members: T[]): Map<string, T> {
  return new Map(members.map((m) => [m.id, m]))
}

/**
 * Extract JSON from AI response that may contain markdown
 */
export function extractJsonFromResponse(response: string): string {
  // Try to find JSON in markdown code blocks first
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // Try to find raw JSON
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  return response
}
