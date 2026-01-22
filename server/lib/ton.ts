import { config, isLocalDev } from './config'
import { logger } from './logger'

/**
 * TON transaction verification using toncenter.com API
 * Documentation: https://toncenter.com/api/v3/
 */

const TON_DECIMALS = 9
const NANOTON = 10 ** TON_DECIMALS

/**
 * Convert TON to nanoTON
 */
export function toNano(amount: number): bigint {
  return BigInt(Math.floor(amount * NANOTON))
}

/**
 * Convert nanoTON to TON
 */
export function fromNano(amount: bigint | string | number): number {
  return Number(amount) / NANOTON
}

/**
 * TON transaction details from toncenter API
 */
export interface TonTransaction {
  hash: string
  lt: string
  account: string
  now: number
  mc_block_seqno: number
  trace_id: string
  in_msg?: {
    hash: string
    source: string | null
    destination: string | null
    value: string
    message_content?: {
      decoded?: {
        type: string
        comment?: string
      }
    }
  }
  out_msgs?: Array<{
    hash: string
    source: string | null
    destination: string | null
    value: string
  }>
  total_fees: string
  description: {
    type: string
    compute_ph?: {
      success: boolean
      exit_code: number
    }
    action?: {
      success: boolean
      result_code: number
    }
  }
  success: boolean
  end_status: string
}

export interface TonCenterResponse {
  transactions: TonTransaction[]
}

export interface VerificationResult {
  verified: boolean
  error?: string
  transaction?: TonTransaction
  details?: {
    from: string
    to: string
    amount: number
    comment?: string
    timestamp: number
  }
}

/**
 * Normalize TON address to raw form for comparison
 * TON addresses can be in different formats (bounceable, non-bounceable, raw)
 */
function normalizeAddress(address: string): string {
  // Remove any prefixes and convert to lowercase for comparison
  return address.toLowerCase().replace(/^(0:|kq|eq|uq)/i, '')
}

/**
 * Compare two TON addresses (handles different formats)
 */
function addressesMatch(addr1: string | null | undefined, addr2: string | null | undefined): boolean {
  if (!addr1 || !addr2) return false
  return normalizeAddress(addr1) === normalizeAddress(addr2)
}

/**
 * Fetch transaction details from toncenter.com API
 */
async function fetchTransaction(txHash: string): Promise<TonTransaction | null> {
  const apiUrl = config.TONCENTER_API_URL
  const apiKey = config.TONCENTER_API_KEY

  // Build URL with hash parameter
  const url = new URL(`${apiUrl}/transactions`)
  url.searchParams.set('hash', txHash)
  url.searchParams.set('limit', '1')

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }

  // Add API key if available (higher rate limits)
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  try {
    const response = await fetch(url.toString(), { headers })

    if (!response.ok) {
      logger.error('TON Center API error', {
        status: response.status,
        statusText: response.statusText,
        txHash,
      })
      return null
    }

    const data = await response.json() as TonCenterResponse

    if (!data.transactions || data.transactions.length === 0) {
      logger.warn('Transaction not found on TON blockchain', { txHash })
      return null
    }

    return data.transactions[0]
  } catch (error) {
    logger.error('Failed to fetch TON transaction', { txHash }, error as Error)
    return null
  }
}

/**
 * Verify a TON transaction matches expected settlement details
 *
 * @param txHash - Transaction hash (BOC hash or transaction hash)
 * @param expectedTo - Expected recipient wallet address
 * @param expectedAmount - Expected amount in TON (not nanoTON)
 * @param expectedComment - Optional: expected comment in transaction
 */
export async function verifyTonTransaction(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  expectedComment?: string
): Promise<VerificationResult> {
  // Skip verification in local development if configured
  if (config.SKIP_TON_VERIFICATION || (isLocalDev && !config.TONCENTER_API_KEY)) {
    logger.warn('Skipping TON verification (dev mode or no API key)', { txHash })
    return {
      verified: true,
      details: {
        from: 'dev-mode',
        to: expectedTo,
        amount: expectedAmount,
        timestamp: Date.now(),
      },
    }
  }

  // Fetch transaction from TON blockchain
  const tx = await fetchTransaction(txHash)

  if (!tx) {
    return {
      verified: false,
      error: 'Transaction not found on TON blockchain. It may still be processing.',
    }
  }

  // Check if transaction was successful
  if (!tx.success) {
    return {
      verified: false,
      error: `Transaction failed on-chain. Status: ${tx.end_status}`,
      transaction: tx,
    }
  }

  // Get the incoming message (the actual transfer)
  const inMsg = tx.in_msg
  if (!inMsg) {
    return {
      verified: false,
      error: 'Transaction has no incoming message (not a transfer)',
      transaction: tx,
    }
  }

  // Verify recipient address matches
  if (!addressesMatch(inMsg.destination, expectedTo)) {
    return {
      verified: false,
      error: `Recipient mismatch. Expected: ${expectedTo}, Got: ${inMsg.destination}`,
      transaction: tx,
    }
  }

  // Verify amount (with small tolerance for fees)
  const actualAmount = fromNano(inMsg.value)
  const tolerance = 0.01 // Allow 0.01 TON tolerance for rounding
  if (actualAmount < expectedAmount - tolerance) {
    return {
      verified: false,
      error: `Amount mismatch. Expected: ${expectedAmount} TON, Got: ${actualAmount} TON`,
      transaction: tx,
    }
  }

  // Optionally verify comment
  if (expectedComment) {
    const actualComment = inMsg.message_content?.decoded?.comment
    if (!actualComment?.includes(expectedComment)) {
      logger.warn('Transaction comment mismatch (non-fatal)', {
        expected: expectedComment,
        actual: actualComment,
      })
      // Don't fail on comment mismatch, just log it
    }
  }

  // Extract transaction details
  const details = {
    from: inMsg.source || 'unknown',
    to: inMsg.destination || expectedTo,
    amount: actualAmount,
    comment: inMsg.message_content?.decoded?.comment,
    timestamp: tx.now * 1000, // Convert to milliseconds
  }

  logger.info('TON transaction verified successfully', {
    txHash,
    from: details.from,
    to: details.to,
    amount: details.amount,
  })

  return {
    verified: true,
    transaction: tx,
    details,
  }
}

/**
 * Get transaction details without verification (for display purposes)
 */
export async function getTransactionDetails(txHash: string): Promise<TonTransaction | null> {
  return fetchTransaction(txHash)
}

// ============================================
// Jetton (USDT) Support
// ============================================

/**
 * Known Jetton master addresses on TON mainnet
 */
export const JETTON_MASTERS = {
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // Tether USDT on TON
  USDC: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3728', // USDC on TON
} as const

export type JettonType = keyof typeof JETTON_MASTERS

/**
 * Jetton transfer event structure
 */
export interface JettonTransfer {
  queryId: string
  source: string
  destination: string
  amount: string
  jettonMaster: string
  responseDestination?: string
  forwardPayload?: string
}

/**
 * Fetch Jetton transfers for an account from toncenter
 */
async function fetchJettonTransfers(
  accountAddress: string,
  limit: number = 10
): Promise<JettonTransfer[]> {
  const apiUrl = config.TONCENTER_API_URL
  const apiKey = config.TONCENTER_API_KEY

  const url = new URL(`${apiUrl}/jetton/transfers`)
  url.searchParams.set('address', accountAddress)
  url.searchParams.set('limit', String(limit))

  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  try {
    const response = await fetch(url.toString(), { headers })

    if (!response.ok) {
      logger.error('TON Center Jetton API error', {
        status: response.status,
        accountAddress,
      })
      return []
    }

    const data = await response.json()
    return data.jetton_transfers ?? []
  } catch (error) {
    logger.error('Failed to fetch Jetton transfers', { accountAddress }, error as Error)
    return []
  }
}

/**
 * Verify a Jetton (USDT/USDC) transfer
 *
 * @param txHash - Transaction hash
 * @param expectedTo - Expected recipient wallet address
 * @param expectedAmount - Expected amount (in Jetton units, e.g., USDT has 6 decimals)
 * @param jettonType - Type of Jetton (USDT, USDC)
 */
export async function verifyJettonTransfer(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  jettonType: JettonType = 'USDT'
): Promise<VerificationResult> {
  // Skip verification in dev mode
  if (config.SKIP_TON_VERIFICATION || (isLocalDev && !config.TONCENTER_API_KEY)) {
    logger.warn('Skipping Jetton verification (dev mode)', { txHash, jettonType })
    return {
      verified: true,
      details: {
        from: 'dev-mode',
        to: expectedTo,
        amount: expectedAmount,
        timestamp: Date.now(),
      },
    }
  }

  const jettonMaster = JETTON_MASTERS[jettonType]
  if (!jettonMaster) {
    return {
      verified: false,
      error: `Unknown Jetton type: ${jettonType}`,
    }
  }

  // First, get the transaction to find the account
  const tx = await fetchTransaction(txHash)
  if (!tx) {
    return {
      verified: false,
      error: 'Transaction not found on TON blockchain',
    }
  }

  if (!tx.success) {
    return {
      verified: false,
      error: `Transaction failed on-chain. Status: ${tx.end_status}`,
    }
  }

  // Fetch Jetton transfers for the destination account
  const transfers = await fetchJettonTransfers(expectedTo)

  // Find matching transfer
  const matchingTransfer = transfers.find((transfer) => {
    // Check Jetton master matches
    if (!addressesMatch(transfer.jettonMaster, jettonMaster)) {
      return false
    }

    // Check destination matches
    if (!addressesMatch(transfer.destination, expectedTo)) {
      return false
    }

    // Check amount (Jetton amounts need decimal adjustment)
    // USDT has 6 decimals, so 1 USDT = 1000000
    const decimals = jettonType === 'USDT' ? 6 : 6 // Most stablecoins use 6 decimals
    const actualAmount = Number(transfer.amount) / Math.pow(10, decimals)
    const tolerance = 0.01

    if (actualAmount < expectedAmount - tolerance) {
      return false
    }

    return true
  })

  if (!matchingTransfer) {
    return {
      verified: false,
      error: `No matching ${jettonType} transfer found to ${expectedTo} for ${expectedAmount}`,
    }
  }

  const decimals = 6
  const actualAmount = Number(matchingTransfer.amount) / Math.pow(10, decimals)

  logger.info('Jetton transfer verified successfully', {
    txHash,
    jettonType,
    from: matchingTransfer.source,
    to: matchingTransfer.destination,
    amount: actualAmount,
  })

  return {
    verified: true,
    details: {
      from: matchingTransfer.source,
      to: matchingTransfer.destination,
      amount: actualAmount,
      timestamp: tx.now * 1000,
    },
  }
}

/**
 * Verify any supported token transfer (TON or Jetton)
 */
export async function verifyTokenTransfer(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  tokenType: 'TON' | JettonType = 'TON',
  expectedComment?: string
): Promise<VerificationResult> {
  if (tokenType === 'TON') {
    return verifyTonTransaction(txHash, expectedTo, expectedAmount, expectedComment)
  }

  return verifyJettonTransfer(txHash, expectedTo, expectedAmount, tokenType)
}
