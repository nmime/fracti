import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePayload, verifyTonProof } from '@server/services/ton-proof.service';

// Mock the logger
vi.mock('@server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ton-proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePayload', () => {
    it('should generate a random payload', () => {
      const result = generatePayload();

      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.payload).toBe('string');
      expect(result.payload.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique payloads', () => {
      const result1 = generatePayload();
      const result2 = generatePayload();

      expect(result1.payload).not.toBe(result2.payload);
    });

    it('should set expiration 15 minutes in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = generatePayload();

      // Should be approximately 15 minutes (900 seconds) in the future
      expect(result.expiresAt).toBeGreaterThanOrEqual(now + 890);
      expect(result.expiresAt).toBeLessThanOrEqual(now + 910);
    });
  });

  describe('verifyTonProof', () => {
    it('should reject unknown payload', async () => {
      const result = await verifyTonProof({
        proof: {
          timestamp: Math.floor(Date.now() / 1000),
          domain: { lengthBytes: 9, value: 'localhost' },
          signature: 'base64signature',
          payload: 'unknown-payload-that-was-never-generated',
        },
        wallet: {
          address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          publicKey: '0'.repeat(64),
          walletStateInit: 'te6cckECFgEAAwQAAgE0ARUBFP8A9KQT9LzyyAsCAgEgAxACAUgEBwLm0AHQ0wMhcbCSXwTgItdJwSCSXwTgAtMfIYIQcGx1Z70ighBkc3RyvbCSXwXgA/pAMCD6RAHIygfL/8nQ7UTQgQFA1yH0BDBcgQEI9ApvoTGzkl8H4AXTP8glghBwbHVnupI4MOMNA4IQZHN0teleIQUGAFTtRNCBAQDXIfQEMFyBAQj0Cm+hMbOOY/hBbyKAIcjLHxfL/xbLP8nBzEVA',
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown or expired payload');
    });

    it('should reject expired payload', async () => {
      // Generate a payload
      const { payload } = generatePayload();

      // Try to verify with a very old timestamp
      const result = await verifyTonProof({
        proof: {
          timestamp: Math.floor(Date.now() / 1000) - 1000, // 1000 seconds ago
          domain: { lengthBytes: 9, value: 'localhost' },
          signature: 'base64signature',
          payload,
        },
        wallet: {
          address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          publicKey: '0'.repeat(64),
          walletStateInit: 'te6cckECFgEAAwQAAgE0ARUBFP8A9KQT9LzyyAsCAgEgAxACAUgEBwLm0AHQ0wMhcbCSXwTgItdJwSCSXwTgAtMfIYIQcGx1Z70ighBkc3RyvbCSXwXgA/pAMCD6RAHIygfL/8nQ7UTQgQFA1yH0BDBcgQEI9ApvoTGzkl8H4AXTP8glghBwbHVnupI4MOMNA4IQZHN0teleIQUGAFTtRNCBAQDXIfQEMFyBAQj0Cm+hMbOOY/hBbyKAIcjLHxfL/xbLP8nBzEVA',
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject non-whitelisted domain', async () => {
      const { payload } = generatePayload();

      const result = await verifyTonProof({
        proof: {
          timestamp: Math.floor(Date.now() / 1000),
          domain: { lengthBytes: 11, value: 'evil-site.com' },
          signature: 'base64signature',
          payload,
        },
        wallet: {
          address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          publicKey: '0'.repeat(64),
          walletStateInit: 'te6cckECFgEAAwQAAgE0ARUBFP8A9KQT9LzyyAsCAgEgAxACAUgEBwLm0AHQ0wMhcbCSXwTgItdJwSCSXwTgAtMfIYIQcGx1Z70ighBkc3RyvbCSXwXgA/pAMCD6RAHIygfL/8nQ7UTQgQFA1yH0BDBcgQEI9ApvoTGzkl8H4AXTP8glghBwbHVnupI4MOMNA4IQZHN0teleIQUGAFTtRNCBAQDXIfQEMFyBAQj0Cm+hMbOOY/hBbyKAIcjLHxfL/xbLP8nBzEVA',
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed');
    });

    it('should allow localhost domain', async () => {
      const { payload } = generatePayload();

      // This will fail later in verification (address mismatch, signature, etc.)
      // but should pass the domain check
      const result = await verifyTonProof({
        proof: {
          timestamp: Math.floor(Date.now() / 1000),
          domain: { lengthBytes: 9, value: 'localhost' },
          signature: 'base64signature',
          payload,
        },
        wallet: {
          address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
          publicKey: '0'.repeat(64),
          walletStateInit: 'te6cckECFgEAAwQAAgE0ARUBFP8A9KQT9LzyyAsCAgEgAxACAUgEBwLm0AHQ0wMhcbCSXwTgItdJwSCSXwTgAtMfIYIQcGx1Z70ighBkc3RyvbCSXwXgA/pAMCD6RAHIygfL/8nQ7UTQgQFA1yH0BDBcgQEI9ApvoTGzkl8H4AXTP8glghBwbHVnupI4MOMNA4IQZHN0teleIQUGAFTtRNCBAQDXIfQEMFyBAQj0Cm+hMbOOY/hBbyKAIcjLHxfL/xbLP8nBzEVA',
        },
      });

      // Should not fail on domain - will fail on something else
      expect(result.error).not.toContain('Domain not allowed');
    });
  });
});
