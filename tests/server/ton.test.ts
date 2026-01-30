import {
  toNano,
  fromNano,
  verifyTonTransaction,
  verifyJettonTransfer,
  verifyTokenTransfer,
  getTransactionDetails,
  JETTON_MASTERS,
  TON_DECIMALS,
  NANOTON,
  USDT_DECIMALS,
} from '@server/integrations/ton';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the config
vi.mock('@server/config', () => ({
  config: {
    TONCENTER_API_URL: 'https://toncenter.com/api/v3',
    TONCENTER_API_KEY: 'test-api-key',
    SKIP_TON_VERIFICATION: false,
  },
  isDevelopment: false,
}));

// Mock the logger
vi.mock('@server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockReset();
  });

  describe('toNano', () => {
    it('should convert 1 TON to nanoTON', () => {
      expect(toNano(1)).toBe(BigInt(1_000_000_000));
    });

    it('should convert 0.5 TON to nanoTON', () => {
      expect(toNano(0.5)).toBe(BigInt(500_000_000));
    });

    it('should convert 0.000000001 TON to 1 nanoTON', () => {
      expect(toNano(0.000000001)).toBe(BigInt(1));
    });

    it('should convert 100 TON to nanoTON', () => {
      expect(toNano(100)).toBe(BigInt(100_000_000_000));
    });

    it('should handle zero', () => {
      expect(toNano(0)).toBe(BigInt(0));
    });

    it('should handle fractional amounts', () => {
      expect(toNano(1.5)).toBe(BigInt(1_500_000_000));
    });
  });

  describe('fromNano', () => {
    it('should convert nanoTON to TON string (bigint)', () => {
      expect(fromNano(BigInt(1_000_000_000))).toBe('1');
    });

    it('should convert nanoTON to TON string (string)', () => {
      expect(fromNano('1000000000')).toBe('1');
    });

    it('should convert nanoTON to TON string (number)', () => {
      expect(fromNano(1_000_000_000)).toBe('1');
    });

    it('should handle fractional TON amounts', () => {
      expect(fromNano(BigInt(500_000_000))).toBe('0.5');
    });

    it('should handle small amounts', () => {
      expect(fromNano(BigInt(1))).toBe('0.000000001');
    });

    it('should handle zero', () => {
      expect(fromNano(BigInt(0))).toBe('0');
    });
  });

  describe('JETTON_MASTERS', () => {
    it('should have USDT address', () => {
      expect(JETTON_MASTERS.USDT).toBeDefined();
      // USDT is now an Address object from @ton/core
      expect(JETTON_MASTERS.USDT.toString()).toMatch(/^EQ|^UQ/);
    });
  });

  describe('Token Decimals', () => {
    it('should have correct TON decimals (9)', () => {
      expect(TON_DECIMALS).toBe(9);
      expect(NANOTON).toBe(1_000_000_000);
    });

    it('should have correct USDT decimals (6)', () => {
      expect(USDT_DECIMALS).toBe(6);
    });

    it('TON and USDT should have different decimals', () => {
      expect(TON_DECIMALS).not.toBe(USDT_DECIMALS);
      expect(TON_DECIMALS).toBeGreaterThan(USDT_DECIMALS);
    });

    it('should convert TON amounts correctly with 9 decimals', () => {
      // 1 TON = 1,000,000,000 nanoTON
      expect(toNano(1)).toBe(BigInt(NANOTON));
      expect(toNano(0.1)).toBe(BigInt(100_000_000));
    });

    it('should handle USDT amounts with 6 decimals in verification', () => {
      // 100 USDT = 100,000,000 micro-USDT (6 decimals)
      const usdtAmount = 100;
      const microUsdt = usdtAmount * 10 ** USDT_DECIMALS;
      expect(microUsdt).toBe(100_000_000);
    });
  });

  // Valid testnet TON addresses for testing
  const TEST_RECIPIENT = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
  const TEST_SENDER = 'EQBYivdc0GAk-nnczaMnYNuSjpeXu2nJS3DZ4KqLjosX5sVC';

  describe('verifyTonTransaction', () => {
    const mockSuccessfulTx = {
      transactions: [
        {
          hash: 'test-hash',
          lt: '12345',
          account: TEST_RECIPIENT,
          now: Math.floor(Date.now() / 1000),
          mc_block_seqno: 123,
          trace_id: 'trace-123',
          in_msg: {
            hash: 'msg-hash',
            source: TEST_SENDER,
            destination: TEST_RECIPIENT,
            value: '50000000000', // 50 TON in nanoTON
            message_content: {
              decoded: {
                type: 'text_comment',
                comment: 'Settlement payment',
              },
            },
          },
          total_fees: '1000000',
          description: {
            type: 'generic',
            compute_ph: { success: true, exit_code: 0 },
            action: { success: true, result_code: 0 },
          },
          success: true,
          end_status: 'active',
        },
      ],
    };

    it('should verify successful transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response);

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(true);
      expect(result.details?.amount).toBe(50);
      expect(result.details?.to).toBe(TEST_RECIPIENT);
      expect(result.details?.from).toBe(TEST_SENDER);
    });

    it('should fail for transaction not found', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response);

      const result = await verifyTonTransaction('unknown-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail for failed transaction', async () => {
      const failedTx = {
        transactions: [
          {
            ...mockSuccessfulTx.transactions[0],
            success: false,
            end_status: 'frozen',
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(failedTx),
      } as Response);

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('failed');
    });

    it('should fail for amount mismatch', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response);

      const result = await verifyTonTransaction(
        'test-hash',
        TEST_RECIPIENT,
        100, // Expected 100 TON but got 50
      );

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Amount mismatch');
    });

    it('should fail for recipient mismatch', async () => {
      // Use a different valid TON address
      const DIFFERENT_WALLET = 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2';

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response);

      const result = await verifyTonTransaction('test-hash', DIFFERENT_WALLET, 50);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Recipient mismatch');
    });

    it('should allow small tolerance for fees', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response);

      // Expected 49.995 TON, got 50 TON - should pass within tolerance
      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 49.995);

      expect(result.verified).toBe(true);
    });

    it('should handle transaction with no in_msg', async () => {
      const noMsgTx = {
        transactions: [
          {
            ...mockSuccessfulTx.transactions[0],
            in_msg: undefined,
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(noMsgTx),
      } as Response);

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('no incoming message');
    });

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(false);
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50);

      expect(result.verified).toBe(false);
    });

    it('should verify with comment when provided', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response);

      const result = await verifyTonTransaction('test-hash', TEST_RECIPIENT, 50, 'Settlement payment');

      expect(result.verified).toBe(true);
    });
  });

  describe('verifyJettonTransfer', () => {
    const mockSuccessfulJettonTx = {
      transactions: [
        {
          hash: 'test-hash',
          success: true,
          now: Math.floor(Date.now() / 1000),
          end_status: 'active',
        },
      ],
    };

    const mockJettonTransfers = {
      jetton_transfers: [
        {
          queryId: 'query-123',
          source: TEST_SENDER,
          destination: TEST_RECIPIENT,
          amount: '100000000', // 100 USDT (6 decimals)
          jettonMaster: JETTON_MASTERS.USDT.toRawString(),
        },
      ],
    };

    it('should verify successful USDT transfer', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessfulJettonTx),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockJettonTransfers),
        } as Response);

      const result = await verifyJettonTransfer('test-hash', TEST_RECIPIENT, 100, 'USDT');

      expect(result.verified).toBe(true);
      expect(result.details?.amount).toBe(100);
    });

    it('should fail for non-existent transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response);

      const result = await verifyJettonTransfer('unknown-hash', TEST_RECIPIENT, 100, 'USDT');

      expect(result.verified).toBe(false);
    });

    it('should fail for failed transaction', async () => {
      const failedTx = {
        transactions: [
          {
            hash: 'test-hash',
            success: false,
            end_status: 'frozen',
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(failedTx),
      } as Response);

      const result = await verifyJettonTransfer('test-hash', TEST_RECIPIENT, 100, 'USDT');

      expect(result.verified).toBe(false);
    });

    it('should fail for no matching transfer', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessfulJettonTx),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jetton_transfers: [] }),
        } as Response);

      const result = await verifyJettonTransfer('test-hash', TEST_RECIPIENT, 100, 'USDT');

      expect(result.verified).toBe(false);
      expect(result.error).toContain('No matching');
    });
  });

  describe('verifyTokenTransfer', () => {
    it('should call verifyTonTransaction for TON', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            transactions: [
              {
                hash: 'test-hash',
                success: true,
                now: Math.floor(Date.now() / 1000),
                end_status: 'active',
                in_msg: {
                  source: TEST_SENDER,
                  destination: TEST_RECIPIENT,
                  value: '50000000000',
                },
              },
            ],
          }),
      } as Response);

      const result = await verifyTokenTransfer('test-hash', TEST_RECIPIENT, 50, 'TON');

      expect(result.verified).toBe(true);
    });

    it('should call verifyJettonTransfer for USDT', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              transactions: [
                {
                  hash: 'test-hash',
                  success: true,
                  now: Math.floor(Date.now() / 1000),
                  end_status: 'active',
                },
              ],
            }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jetton_transfers: [
                {
                  source: TEST_SENDER,
                  destination: TEST_RECIPIENT,
                  amount: '100000000',
                  jettonMaster: JETTON_MASTERS.USDT.toRawString(),
                },
              ],
            }),
        } as Response);

      const result = await verifyTokenTransfer('test-hash', TEST_RECIPIENT, 100, 'USDT');

      expect(result.verified).toBe(true);
    });
  });

  describe('getTransactionDetails', () => {
    it('should return transaction details', async () => {
      const mockTx = {
        transactions: [
          {
            hash: 'test-hash',
            lt: '12345',
            account: TEST_RECIPIENT,
            now: 1234567890,
            success: true,
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      } as Response);

      const tx = await getTransactionDetails('test-hash');

      expect(tx).toBeDefined();
      expect(tx?.hash).toBe('test-hash');
      expect(tx?.now).toBe(1234567890);
    });

    it('should return null for non-existent transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response);

      const tx = await getTransactionDetails('unknown-hash');

      expect(tx).toBeNull();
    });

    it('should return null on API error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const tx = await getTransactionDetails('test-hash');

      expect(tx).toBeNull();
    });
  });
});
