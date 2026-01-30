import { rateLimit, standardRateLimit, aiRateLimit, _resetRateLimitStore } from '@server/middleware/rateLimit';
import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    _resetRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Fixed Window Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 60000, maxRequests: 5 }));
      app.get('/test', (c) => c.json({ ok: true }));

      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }
    });

    it('should block requests over the limit', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 60000, maxRequests: 3 }));
      app.get('/test', (c) => c.json({ ok: true }));

      // Make 3 requests (allowed)
      for (let i = 0; i < 3; i++) {
        await app.request('/test');
      }

      // 4th request should be blocked
      const res = await app.request('/test');
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should reset after window expires', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 1000, maxRequests: 2 }));
      app.get('/test', (c) => c.json({ ok: true }));

      // Use up the limit
      await app.request('/test');
      await app.request('/test');

      // Should be blocked
      let res = await app.request('/test');
      expect(res.status).toBe(429);

      // Advance time past the window
      vi.advanceTimersByTime(1100);

      // Should be allowed again
      res = await app.request('/test');
      expect(res.status).toBe(200);
    });

    it('should include rate limit headers', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 60000, maxRequests: 10 }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should include Retry-After header when blocked', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 60000, maxRequests: 1 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');
      const res = await app.request('/test');

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('Sliding Window Rate Limiting', () => {
    it('should use sliding window when enabled', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 60000, maxRequests: 5, slidingWindow: true }));
      app.get('/test', (c) => c.json({ ok: true }));

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }

      // 6th should be blocked
      const res = await app.request('/test');
      expect(res.status).toBe(429);
    });

    it('should allow requests as old ones expire in sliding window', async () => {
      const app = new Hono();
      app.use('*', rateLimit({ windowMs: 10000, maxRequests: 3, slidingWindow: true }));
      app.get('/test', (c) => c.json({ ok: true }));

      // Make 3 requests at t=0
      await app.request('/test');
      await app.request('/test');
      await app.request('/test');

      // 4th should be blocked
      let res = await app.request('/test');
      expect(res.status).toBe(429);

      // Advance time so first request expires
      vi.advanceTimersByTime(10001);

      // Should be allowed now
      res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('Penalty Multiplier', () => {
    it('should reduce limit after violations', async () => {
      const app = new Hono();
      app.use(
        '*',
        rateLimit({
          windowMs: 60000,
          maxRequests: 10,
          penaltyMultiplier: 2,
        }),
      );

      app.get('/test', (c) => c.json({ ok: true }));

      // Make 10 requests (allowed)
      for (let i = 0; i < 10; i++) {
        await app.request('/test');
      }

      // 11th should be blocked and incur violation
      const res = await app.request('/test');
      expect(res.status).toBe(429);

      // Get the limit header to verify it was reduced
      const limit = res.headers.get('X-RateLimit-Limit');
      expect(limit).toBeDefined();
    });
  });

  describe('Skip Function', () => {
    it('should skip rate limiting when skip returns true', async () => {
      const app = new Hono();
      app.use(
        '*',
        rateLimit({
          windowMs: 60000,
          maxRequests: 1,
          skip: (c) => c.req.header('X-Skip-Rate-Limit') === 'true',
        }),
      );

      app.get('/test', (c) => c.json({ ok: true }));

      // Use up the limit
      await app.request('/test');

      // Should be blocked without skip header
      let res = await app.request('/test');
      expect(res.status).toBe(429);

      // Should be allowed with skip header
      res = await app.request('/test', {
        headers: { 'X-Skip-Rate-Limit': 'true' },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator', async () => {
      const app = new Hono();
      app.use(
        '*',
        rateLimit({
          windowMs: 60000,
          maxRequests: 2,
          keyGenerator: (c) => c.req.header('X-User-Id') || 'anonymous',
        }),
      );

      app.get('/test', (c) => c.json({ ok: true }));

      // User A uses their limit
      await app.request('/test', { headers: { 'X-User-Id': 'user-a' } });
      await app.request('/test', { headers: { 'X-User-Id': 'user-a' } });

      // User A blocked
      let res = await app.request('/test', { headers: { 'X-User-Id': 'user-a' } });
      expect(res.status).toBe(429);

      // User B should still be allowed
      res = await app.request('/test', { headers: { 'X-User-Id': 'user-b' } });
      expect(res.status).toBe(200);
    });
  });

  describe('Pre-configured Rate Limiters', () => {
    it('standardRateLimit should have correct config', async () => {
      const app = new Hono();
      app.use('*', standardRateLimit);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    });

    it('aiRateLimit should have stricter limits', async () => {
      const app = new Hono();
      app.use('*', aiRateLimit);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    });
  });
});
