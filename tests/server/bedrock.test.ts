import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock AWS SDK before importing bedrock module
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class MockBedrockRuntimeClient {
    send = mockSend;
  },
  InvokeModelCommand: class MockInvokeModelCommand {
    constructor(public input: unknown) {}
  },
  ThrottlingException: class ThrottlingException extends Error {
    name = 'ThrottlingException';

    constructor() {
      super('Request throttled');
    }
  },
  ServiceQuotaExceededException: class ServiceQuotaExceededException extends Error {
    name = 'ServiceQuotaExceededException';

    constructor() {
      super('Service quota exceeded');
    }
  },
}));

// Mock config
vi.mock('@server/config', () => ({
  config: {
    AWS_REGION: 'us-east-1',
    BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
}));

// Mock logger
vi.mock('@server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Bedrock AI Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('invokeClaudeText', () => {
    it('should successfully invoke Claude and return text', async () => {
      const { invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [{ type: 'text', text: '{"amount": 50, "currency": "TON"}' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        ),
      });

      const result = await invokeClaudeText('System prompt', 'User message', { skipCache: true });

      expect(result).toBe('{"amount": 50, "currency": "TON"}');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should cache responses by default', async () => {
      // Reset module to clear cache
      vi.resetModules();
      const { invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [{ type: 'text', text: 'cached response' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        ),
      });

      // First call
      const result1 = await invokeClaudeText('System', 'Message');

      // Second call with same params should use cache
      const result2 = await invokeClaudeText('System', 'Message');

      expect(result1).toBe(result2);
      // Should only call the API once due to caching
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when skipCache is true', async () => {
      vi.resetModules();
      const { invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [{ type: 'text', text: 'response' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        ),
      });

      await invokeClaudeText('System', 'Message', { skipCache: true });
      await invokeClaudeText('System', 'Message', { skipCache: true });

      // Should call API twice since cache is skipped
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw on invalid response format', async () => {
      vi.resetModules();
      const { invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            invalid: 'response',
          }),
        ),
      });

      await expect(invokeClaudeText('System', 'Message', { skipCache: true })).rejects.toThrow(
        'Invalid response from AI model',
      );
    });

    it('should throw on empty content', async () => {
      vi.resetModules();
      const { invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 0 },
          }),
        ),
      });

      await expect(invokeClaudeText('System', 'Message', { skipCache: true })).rejects.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      vi.resetModules();
      const { getCacheStats, invokeClaudeText } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [{ type: 'text', text: 'response' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        ),
      });

      // Initial stats
      let stats = getCacheStats();
      const initialSize = stats.size;

      // Make a cached request
      await invokeClaudeText('Test', 'Query');

      stats = getCacheStats();
      expect(stats.size).toBe(initialSize + 1);
    });
  });

  describe('parseExpenseWithFallback', () => {
    it('should parse expense successfully with AI', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  payer: 'John',
                  amount: 50,
                  currency: 'TON',
                  description: 'dinner',
                  beneficiaries: ['Alice', 'Bob'],
                  confidence: 0.95,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        ),
      });

      const result = await parseExpenseWithFallback('John paid 50 TON for dinner with Alice and Bob');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.data?.amount).toBe(50);
      expect(result.data?.currency).toBe('TON');
    });

    it('should fallback to regex parser when AI fails', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockRejectedValueOnce(new Error('AI unavailable'));

      const result = await parseExpenseWithFallback('paid 50 TON for dinner');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.data?.amount).toBe(50);
      expect(result.data?.currency).toBe('TON');
      expect(result.data?.confidence).toBeLessThan(0.5); // Low confidence for fallback
    });

    it('should extract USD from dollar amounts', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockRejectedValueOnce(new Error('AI unavailable'));

      const result = await parseExpenseWithFallback('paid $30 for lunch');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.data?.amount).toBe(30);
      expect(result.data?.currency).toBe('USD');
    });

    it('should return error when both AI and fallback fail', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockRejectedValueOnce(new Error('AI unavailable'));

      // Message with no parseable amount
      const result = await parseExpenseWithFallback('hello world');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('parseReceiptWithFallback', () => {
    it('should parse receipt successfully', async () => {
      vi.resetModules();
      const { parseReceiptWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  items: [
                    { name: 'Coffee', quantity: 2, price: 5.0 },
                    { name: 'Sandwich', quantity: 1, price: 8.5 },
                  ],
                  total: 18.5,
                  tax: 1.5,
                  currency: 'USD',
                  merchant: 'Cafe',
                  date: '2024-01-15',
                  confidence: 0.9,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 500, output_tokens: 200 },
          }),
        ),
      });

      const result = await parseReceiptWithFallback('base64imagedata', 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.data?.items.length).toBe(2);
      expect(result.data?.total).toBe(18.5);
    });

    it('should return error when AI fails (no fallback for vision)', async () => {
      vi.resetModules();
      const { parseReceiptWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockRejectedValueOnce(new Error('Vision AI unavailable'));

      const result = await parseReceiptWithFallback('base64imagedata', 'image/jpeg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not parse receipt');
    });
  });

  describe('parseExpenseWithFallback - Category Suggestions', () => {
    it('should suggest "food" category for groceries', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  payer: null,
                  amount: 50,
                  currency: 'TON',
                  description: 'groceries',
                  beneficiaries: [],
                  category: 'food',
                  confidence: 0.9,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        ),
      });

      const result = await parseExpenseWithFallback('paid 50 for groceries');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.data?.category).toBe('food');
      expect(result.data?.description).toBe('groceries');
    });

    it('should suggest "transport" category for uber ride', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  payer: null,
                  amount: 30,
                  currency: 'USD',
                  description: 'uber ride',
                  beneficiaries: [],
                  category: 'transport',
                  confidence: 0.95,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        ),
      });

      const result = await parseExpenseWithFallback('uber ride $30');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.data?.category).toBe('transport');
      expect(result.data?.description).toBe('uber ride');
      expect(result.data?.amount).toBe(30);
      expect(result.data?.currency).toBe('USD');
    });

    it('should suggest "entertainment" category for netflix subscription', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  payer: null,
                  amount: 15,
                  currency: 'TON',
                  description: 'netflix subscription',
                  beneficiaries: [],
                  category: 'entertainment',
                  confidence: 0.92,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        ),
      });

      const result = await parseExpenseWithFallback('netflix subscription');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.data?.category).toBe('entertainment');
      expect(result.data?.description).toBe('netflix subscription');
    });

    it('should suggest "food" category for dinner at restaurant', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  payer: null,
                  amount: 100,
                  currency: 'TON',
                  description: 'dinner at restaurant',
                  beneficiaries: [],
                  category: 'food',
                  confidence: 0.93,
                }),
              },
            ],
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        ),
      });

      const result = await parseExpenseWithFallback('dinner at restaurant');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(false);
      expect(result.data?.category).toBe('food');
      expect(result.data?.description).toBe('dinner at restaurant');
    });

    it('should return null category when using fallback parser', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      mockSend.mockRejectedValueOnce(new Error('AI unavailable'));

      const result = await parseExpenseWithFallback('paid 50 TON for groceries');

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.data?.category).toBe(null);
      expect(result.data?.amount).toBe(50);
    });

    it('should handle various valid categories', async () => {
      vi.resetModules();
      const { parseExpenseWithFallback } = await import('@server/integrations/bedrock');

      const testCases = [
        { input: 'paid rent 1200', expectedCategory: 'rent' },
        { input: 'gym membership 50', expectedCategory: 'health' },
        { input: 'flight tickets 500', expectedCategory: 'travel' },
        { input: 'bought new shoes 80', expectedCategory: 'shopping' },
        { input: 'electricity bill 75', expectedCategory: 'utilities' },
      ];

      for (const testCase of testCases) {
        mockSend.mockResolvedValueOnce({
          body: new TextEncoder().encode(
            JSON.stringify({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    payer: null,
                    amount: 100,
                    currency: 'TON',
                    description: testCase.input,
                    beneficiaries: [],
                    category: testCase.expectedCategory,
                    confidence: 0.85,
                  }),
                },
              ],
              stop_reason: 'end_turn',
              usage: { input_tokens: 50, output_tokens: 100 },
            }),
          ),
        });

        const result = await parseExpenseWithFallback(testCase.input);

        expect(result.success).toBe(true);
        expect(result.data?.category).toBe(testCase.expectedCategory);
      }
    });
  });
});
