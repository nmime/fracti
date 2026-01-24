import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toNano,
  fromNano,
  verifyTonTransaction,
  verifyJettonTransfer,
  verifyTokenTransfer,
  getTransactionDetails,
  JETTON_MASTERS,
} from '@server/lib/ton'

// Mock the config
vi.mock('@server/lib/config', () => ({
  config: {
    TONCENTER_API_URL: 'https://toncenter.com/api/v3',
    TONCENTER_API_KEY: 'test-api-key',
    SKIP_TON_VERIFICATION: false,
  },
  isLocalDev: false,
}))

// Mock the logger
vi.mock('@server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockReset()
  })

  describe('toNano', () => {
    it('should convert 1 TON to nanoTON', () => {
      expect(toNano(1)).toBe(BigInt(1_000_000_000))
    })

    it('should convert 0.5 TON to nanoTON', () => {
      expect(toNano(0.5)).toBe(BigInt(500_000_000))
    })

    it('should convert 0.000000001 TON to 1 nanoTON', () => {
      expect(toNano(0.000000001)).toBe(BigInt(1))
    })

    it('should convert 100 TON to nanoTON', () => {
      expect(toNano(100)).toBe(BigInt(100_000_000_000))
    })

    it('should handle zero', () => {
      expect(toNano(0)).toBe(BigInt(0))
    })

    it('should handle fractional amounts', () => {
      expect(toNano(1.5)).toBe(BigInt(1_500_000_000))
    })
  })

  describe('fromNano', () => {
    it('should convert nanoTON to TON (bigint)', () => {
      expect(fromNano(BigInt(1_000_000_000))).toBe(1)
    })

    it('should convert nanoTON to TON (string)', () => {
      expect(fromNano('1000000000')).toBe(1)
    })

    it('should convert nanoTON to TON (number)', () => {
      expect(fromNano(1_000_000_000)).toBe(1)
    })

    it('should handle fractional TON amounts', () => {
      expect(fromNano(BigInt(500_000_000))).toBe(0.5)
    })

    it('should handle small amounts', () => {
      expect(fromNano(BigInt(1))).toBe(0.000000001)
    })

    it('should handle zero', () => {
      expect(fromNano(BigInt(0))).toBe(0)
    })
  })

  describe('JETTON_MASTERS', () => {
    it('should have USDT address', () => {
      expect(JETTON_MASTERS.USDT).toBeDefined()
      expect(JETTON_MASTERS.USDT).toMatch(/^EQ/)
    })

    it('should have USDC address', () => {
      expect(JETTON_MASTERS.USDC).toBeDefined()
      expect(JETTON_MASTERS.USDC).toMatch(/^EQ/)
    })
  })

  describe('verifyTonTransaction', () => {
    const mockSuccessfulTx = {
      transactions: [
        {
          hash: 'test-hash',
          lt: '12345',
          account: 'EQRecipient...',
          now: Math.floor(Date.now() / 1000),
          mc_block_seqno: 123,
          trace_id: 'trace-123',
          in_msg: {
            hash: 'msg-hash',
            source: 'EQSender...',
            destination: 'EQRecipient...',
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
    }

    it('should verify successful transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(true)
      expect(result.details?.amount).toBe(50)
      expect(result.details?.to).toBe('EQRecipient...')
      expect(result.details?.from).toBe('EQSender...')
    })

    it('should fail for transaction not found', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response)

      const result = await verifyTonTransaction(
        'unknown-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should fail for failed transaction', async () => {
      const failedTx = {
        transactions: [
          {
            ...mockSuccessfulTx.transactions[0],
            success: false,
            end_status: 'frozen',
          },
        ],
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(failedTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('failed')
    })

    it('should fail for amount mismatch', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        100 // Expected 100 TON but got 50
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('Amount mismatch')
    })

    it('should fail for recipient mismatch', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQDifferentWallet...',
        50
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('Recipient mismatch')
    })

    it('should allow small tolerance for fees', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response)

      // Expected 49.995 TON, got 50 TON - should pass within tolerance
      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        49.995
      )

      expect(result.verified).toBe(true)
    })

    it('should handle transaction with no in_msg', async () => {
      const noMsgTx = {
        transactions: [
          {
            ...mockSuccessfulTx.transactions[0],
            in_msg: undefined,
          },
        ],
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(noMsgTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('no incoming message')
    })

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(false)
    })

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50
      )

      expect(result.verified).toBe(false)
    })

    it('should verify with comment when provided', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessfulTx),
      } as Response)

      const result = await verifyTonTransaction(
        'test-hash',
        'EQRecipient...',
        50,
        'Settlement payment'
      )

      expect(result.verified).toBe(true)
    })
  })

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
    }

    const mockJettonTransfers = {
      jetton_transfers: [
        {
          queryId: 'query-123',
          source: 'EQSender...',
          destination: 'EQRecipient...',
          amount: '100000000', // 100 USDT (6 decimals)
          jettonMaster: JETTON_MASTERS.USDT,
        },
      ],
    }

    it('should verify successful USDT transfer', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessfulJettonTx),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockJettonTransfers),
        } as Response)

      const result = await verifyJettonTransfer(
        'test-hash',
        'EQRecipient...',
        100,
        'USDT'
      )

      expect(result.verified).toBe(true)
      expect(result.details?.amount).toBe(100)
    })

    it('should fail for non-existent transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response)

      const result = await verifyJettonTransfer(
        'unknown-hash',
        'EQRecipient...',
        100,
        'USDT'
      )

      expect(result.verified).toBe(false)
    })

    it('should fail for failed transaction', async () => {
      const failedTx = {
        transactions: [
          {
            hash: 'test-hash',
            success: false,
            end_status: 'frozen',
          },
        ],
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(failedTx),
      } as Response)

      const result = await verifyJettonTransfer(
        'test-hash',
        'EQRecipient...',
        100,
        'USDT'
      )

      expect(result.verified).toBe(false)
    })

    it('should fail for no matching transfer', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSuccessfulJettonTx),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ jetton_transfers: [] }),
        } as Response)

      const result = await verifyJettonTransfer(
        'test-hash',
        'EQRecipient...',
        100,
        'USDT'
      )

      expect(result.verified).toBe(false)
      expect(result.error).toContain('No matching')
    })
  })

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
                  source: 'EQSender...',
                  destination: 'EQRecipient...',
                  value: '50000000000',
                },
              },
            ],
          }),
      } as Response)

      const result = await verifyTokenTransfer(
        'test-hash',
        'EQRecipient...',
        50,
        'TON'
      )

      expect(result.verified).toBe(true)
    })

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
                  source: 'EQSender...',
                  destination: 'EQRecipient...',
                  amount: '100000000',
                  jettonMaster: JETTON_MASTERS.USDT,
                },
              ],
            }),
        } as Response)

      const result = await verifyTokenTransfer(
        'test-hash',
        'EQRecipient...',
        100,
        'USDT'
      )

      expect(result.verified).toBe(true)
    })
  })

  describe('getTransactionDetails', () => {
    it('should return transaction details', async () => {
      const mockTx = {
        transactions: [
          {
            hash: 'test-hash',
            lt: '12345',
            account: 'EQAccount...',
            now: 1234567890,
            success: true,
          },
        ],
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTx),
      } as Response)

      const tx = await getTransactionDetails('test-hash')

      expect(tx).toBeDefined()
      expect(tx?.hash).toBe('test-hash')
      expect(tx?.now).toBe(1234567890)
    })

    it('should return null for non-existent transaction', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      } as Response)

      const tx = await getTransactionDetails('unknown-hash')

      expect(tx).toBeNull()
    })

    it('should return null on API error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      const tx = await getTransactionDetails('test-hash')

      expect(tx).toBeNull()
    })
  })
})
