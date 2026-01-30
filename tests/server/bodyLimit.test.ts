import { bodyLimit, BodyLimits } from '@server/middleware/bodyLimit';
import { Hono } from 'hono';
import { describe, it, expect } from 'vitest';

describe('Body Limit Middleware', () => {
  describe('Basic Body Size Limiting', () => {
    it('should allow requests under the limit', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 })); // 1KB limit
      app.post('/test', (c) => c.json({ ok: true }));

      const smallBody = JSON.stringify({ data: 'x'.repeat(500) });
      const res = await app.request('/test', {
        method: 'POST',
        body: smallBody,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': smallBody.length.toString(),
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('should block requests over the limit via Content-Length', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 })); // 1KB limit
      app.post('/test', (c) => c.json({ ok: true }));

      const largeBody = JSON.stringify({ data: 'x'.repeat(2000) });
      const res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': largeBody.length.toString(),
        },
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe('Payload Too Large');
      expect(json.message).toContain('Request body too large');
      expect(json.maxSize).toBe(1024);
      expect(json.receivedSize).toBeGreaterThan(1024);
    });

    it('should block requests over the limit via actual body size', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 })); // 1KB limit
      app.post('/test', (c) => c.json({ ok: true }));

      // Don't send Content-Length to test actual body size check
      const largeBody = JSON.stringify({ data: 'x'.repeat(2000) });
      const res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe('Payload Too Large');
      expect(json.maxSize).toBe(1024);
      expect(json.receivedSize).toBeGreaterThan(1024);
    });

    it('should return 400 for invalid Content-Length header', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 }));
      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'POST',
        body: 'test',
        headers: {
          'Content-Length': 'invalid',
        },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Bad Request');
      expect(json.message).toBe('Invalid Content-Length header');
    });
  });

  describe('Error Message Formatting', () => {
    it('should include formatted size information in error', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 * 1024 })); // 1MB
      app.post('/test', (c) => c.json({ ok: true }));

      const largeBody = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
      const res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        headers: {
          'Content-Length': largeBody.length.toString(),
        },
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.maxSizeFormatted).toBeDefined();
      expect(json.receivedSizeFormatted).toBeDefined();
      expect(json.maxSizeFormatted).toMatch(/MB|KB/);
      expect(json.receivedSizeFormatted).toMatch(/MB|KB/);
    });

    it('should use custom error message if provided', async () => {
      const customMessage = 'Your payload is way too big!';
      const app = new Hono();
      app.use(
        '*',
        bodyLimit({
          maxSize: 100,
          message: customMessage,
        }),
      );

      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'POST',
        body: 'x'.repeat(200),
        headers: {
          'Content-Length': '200',
        },
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.message).toBe(customMessage);
    });
  });

  describe('Route-Specific Limits', () => {
    it('should apply different limits to different routes', async () => {
      const app = new Hono();

      // Apply different limits to different routes
      // (No global limit, so route-specific limits work independently)
      app.use('/api/standard/*', bodyLimit({ maxSize: 1024 }));
      app.use('/api/ai/*', bodyLimit({ maxSize: 10 * 1024 }));

      app.post('/api/standard/endpoint', (c) => c.json({ ok: true }));
      app.post('/api/ai/generate', (c) => c.json({ ok: true }));

      // 2KB body - should fail on standard endpoint
      const mediumBody = JSON.stringify({ data: 'x'.repeat(2000) });

      const standardRes = await app.request('/api/standard/endpoint', {
        method: 'POST',
        body: mediumBody,
        headers: {
          'Content-Length': mediumBody.length.toString(),
        },
      });

      expect(standardRes.status).toBe(413);

      // Same 2KB body - should pass on AI endpoint
      const aiRes = await app.request('/api/ai/generate', {
        method: 'POST',
        body: mediumBody,
        headers: {
          'Content-Length': mediumBody.length.toString(),
        },
      });

      expect(aiRes.status).toBe(200);
    });
  });

  describe('Skip Function', () => {
    it('should skip body limit when skip returns true', async () => {
      const app = new Hono();
      app.use(
        '*',
        bodyLimit({
          maxSize: 100,
          skip: (c) => c.req.header('X-Skip-Limit') === 'true',
        }),
      );

      app.post('/test', (c) => c.json({ ok: true }));

      const largeBody = 'x'.repeat(200);

      // Should be blocked without skip header
      let res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
      });

      expect(res.status).toBe(413);

      // Should be allowed with skip header
      res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        headers: {
          'X-Skip-Limit': 'true',
        },
      });

      expect(res.status).toBe(200);
    });

    it('should not skip when skip returns false', async () => {
      const app = new Hono();
      app.use(
        '*',
        bodyLimit({
          maxSize: 100,
          skip: (c) => c.req.header('X-Admin') === 'true',
        }),
      );

      app.post('/test', (c) => c.json({ ok: true }));

      const largeBody = 'x'.repeat(200);

      const res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        headers: {
          'X-Admin': 'false',
        },
      });

      expect(res.status).toBe(413);
    });
  });

  describe('Common Body Limit Constants', () => {
    it('should export standard limit constant', () => {
      expect(BodyLimits.STANDARD).toBe(1024 * 1024); // 1MB
    });

    it('should export AI endpoint limit constant', () => {
      expect(BodyLimits.AI_ENDPOINT).toBe(10 * 1024 * 1024); // 10MB
    });

    it('should export webhook limit constant', () => {
      expect(BodyLimits.WEBHOOK).toBe(100 * 1024); // 100KB
    });

    it('should successfully use standard limit', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: BodyLimits.STANDARD }));
      app.post('/test', (c) => c.json({ ok: true }));

      const body = JSON.stringify({ data: 'x'.repeat(500 * 1024) }); // 500KB
      const res = await app.request('/test', {
        method: 'POST',
        body,
        headers: {
          'Content-Length': body.length.toString(),
        },
      });

      expect(res.status).toBe(200);
    });

    it('should successfully use AI endpoint limit', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: BodyLimits.AI_ENDPOINT }));
      app.post('/test', (c) => c.json({ ok: true }));

      const body = JSON.stringify({ data: 'x'.repeat(5 * 1024 * 1024) }); // 5MB
      const res = await app.request('/test', {
        method: 'POST',
        body,
        headers: {
          'Content-Length': body.length.toString(),
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty body', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 }));
      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'POST',
        body: '',
        headers: {
          'Content-Length': '0',
        },
      });

      expect(res.status).toBe(200);
    });

    it('should handle body exactly at the limit', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 100 }));
      app.post('/test', (c) => c.json({ ok: true }));

      const body = 'x'.repeat(100);
      const res = await app.request('/test', {
        method: 'POST',
        body,
        headers: {
          'Content-Length': '100',
        },
      });

      expect(res.status).toBe(200);
    });

    it('should handle body one byte over the limit', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 100 }));
      app.post('/test', (c) => c.json({ ok: true }));

      const body = 'x'.repeat(101);
      const res = await app.request('/test', {
        method: 'POST',
        body,
        headers: {
          'Content-Length': '101',
        },
      });

      expect(res.status).toBe(413);
    });

    it('should handle GET requests (no body)', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
    });

    it('should handle requests with Content-Length 0', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 }));
      app.post('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        method: 'POST',
        headers: {
          'Content-Length': '0',
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent DoS via large payload', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: BodyLimits.STANDARD }));
      app.post('/test', (c) => c.json({ ok: true }));

      // Try to send 10MB payload to 1MB endpoint
      const hugeBody = JSON.stringify({ data: 'x'.repeat(10 * 1024 * 1024) });
      const res = await app.request('/test', {
        method: 'POST',
        body: hugeBody,
        headers: {
          'Content-Length': hugeBody.length.toString(),
        },
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toBe('Payload Too Large');
    });

    it('should prevent chunked encoding attacks', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 100 }));
      app.post('/test', (c) => c.json({ ok: true }));

      // Send large body without Content-Length (simulating chunked)
      const largeBody = 'x'.repeat(200);
      const res = await app.request('/test', {
        method: 'POST',
        body: largeBody,
        // No Content-Length header
      });

      expect(res.status).toBe(413);
    });

    it('should validate actual body size even with correct Content-Length', async () => {
      const app = new Hono();
      app.use('*', bodyLimit({ maxSize: 1024 }));
      app.post('/test', (c) => c.json({ ok: true }));

      // This tests that we check actual body, not just trust Content-Length
      const body = 'x'.repeat(2000);
      const res = await app.request('/test', {
        method: 'POST',
        body,
        headers: {
          'Content-Length': body.length.toString(),
        },
      });

      expect(res.status).toBe(413);
    });
  });
});
