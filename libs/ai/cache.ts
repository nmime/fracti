import type { CacheEntry } from './types';

/**
 * Response cache for AI calls
 * Implements LRU-like eviction with TTL
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

const responseCache = new Map<string, CacheEntry>();

export function getCacheKey(systemPrompt: string, userMessage: string): string {
  const input = `${systemPrompt}:${userMessage}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `text:${hash}`;
}

export function getCachedResponse(key: string): string | null {
  const entry = responseCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);

    return null;
  }

  entry.hits++;

  return entry.response;
}

export function cacheResponse(key: string, response: string): void {
  // Evict oldest entries if cache is full
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const entries = Array.from(responseCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.ceil(MAX_CACHE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) {
      responseCache.delete(entries[i][0]);
    }
  }

  responseCache.set(key, {
    response,
    timestamp: Date.now(),
    hits: 0,
  });
}

export function clearCache(): void {
  responseCache.clear();
}

export function getCacheStats(): { size: number; maxSize: number; hits: number } {
  let totalHits = 0;
  for (const entry of responseCache.values()) {
    totalHits += entry.hits;
  }

  return { size: responseCache.size, maxSize: MAX_CACHE_SIZE, hits: totalHits };
}
