import { config, isDevelopment } from '../config'
import { logger } from '../utils/logger'

const TON_DECIMALS = 9
const NANOTON = 10 ** TON_DECIMALS

export function toNano(amount: number): bigint {
  return BigInt(Math.floor(amount * NANOTON))
}

export function fromNano(amount: bigint | string | number): number {
  return Number(amount) / NANOTON
}

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

function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/^(0:|kq|eq|uq)/i, '')
}

function addressesMatch(
  addr1: string | null | undefined,
  addr2: string | null | undefined
): boolean {
  if (!addr1 || !addr2) return false
  return normalizeAddress(addr1) === normalizeAddress(addr2)
}

async function fetchTransaction(txHash: string): Promise<TonTransaction | null> {
  const apiUrl = config.TONCENTER_API_URL
  const apiKey = config.TONCENTER_API_KEY

  const url = new URL(`${apiUrl}/transactions`)
  url.searchParams.set('hash', txHash)
  url.searchParams.set('limit', '1')

  const headers: Record<string, string> = { Accept: 'application/json' }
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

    const data = (await response.json()) as TonCenterResponse

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

export async function verifyTonTransaction(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  expectedComment?: string
): Promise<VerificationResult> {
  if (config.SKIP_TON_VERIFICATION || (isDevelopment && !config.TONCENTER_API_KEY)) {
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

  const tx = await fetchTransaction(txHash)

  if (!tx) {
    return {
      verified: false,
      error: 'Transaction not found on TON blockchain. It may still be processing.',
    }
  }

  if (!tx.success) {
    return {
      verified: false,
      error: `Transaction failed on-chain. Status: ${tx.end_status}`,
      transaction: tx,
    }
  }

  const inMsg = tx.in_msg
  if (!inMsg) {
    return {
      verified: false,
      error: 'Transaction has no incoming message (not a transfer)',
      transaction: tx,
    }
  }

  if (!addressesMatch(inMsg.destination, expectedTo)) {
    return {
      verified: false,
      error: `Recipient mismatch. Expected: ${expectedTo}, Got: ${inMsg.destination}`,
      transaction: tx,
    }
  }

  const actualAmount = fromNano(inMsg.value)
  const tolerance = 0.01
  if (actualAmount < expectedAmount - tolerance) {
    return {
      verified: false,
      error: `Amount mismatch. Expected: ${expectedAmount} TON, Got: ${actualAmount} TON`,
      transaction: tx,
    }
  }

  if (expectedComment) {
    const actualComment = inMsg.message_content?.decoded?.comment
    if (!actualComment?.includes(expectedComment)) {
      logger.warn('Transaction comment mismatch (non-fatal)', {
        expected: expectedComment,
        actual: actualComment,
      })
    }
  }

  const details = {
    from: inMsg.source || 'unknown',
    to: inMsg.destination || expectedTo,
    amount: actualAmount,
    comment: inMsg.message_content?.decoded?.comment,
    timestamp: tx.now * 1000,
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

export async function getTransactionDetails(txHash: string): Promise<TonTransaction | null> {
  return fetchTransaction(txHash)
}

// Jetton support
export const JETTON_MASTERS = {
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  USDC: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3728',
} as const

export type JettonType = keyof typeof JETTON_MASTERS

export interface JettonTransfer {
  queryId: string
  source: string
  destination: string
  amount: string
  jettonMaster: string
  responseDestination?: string
  forwardPayload?: string
}

async function fetchJettonTransfers(
  accountAddress: string,
  limit: number = 10
): Promise<JettonTransfer[]> {
  const apiUrl = config.TONCENTER_API_URL
  const apiKey = config.TONCENTER_API_KEY

  const url = new URL(`${apiUrl}/jetton/transfers`)
  url.searchParams.set('address', accountAddress)
  url.searchParams.set('limit', String(limit))

  const headers: Record<string, string> = { Accept: 'application/json' }
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

    const data = (await response.json()) as { jetton_transfers?: JettonTransfer[] }
    return data.jetton_transfers ?? []
  } catch (error) {
    logger.error('Failed to fetch Jetton transfers', { accountAddress }, error as Error)
    return []
  }
}

export async function verifyJettonTransfer(
  txHash: string,
  expectedTo: string,
  expectedAmount: number,
  jettonType: JettonType = 'USDT'
): Promise<VerificationResult> {
  if (config.SKIP_TON_VERIFICATION || (isDevelopment && !config.TONCENTER_API_KEY)) {
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

  const transfers = await fetchJettonTransfers(expectedTo)

  const matchingTransfer = transfers.find((transfer) => {
    if (!addressesMatch(transfer.jettonMaster, jettonMaster)) {
      return false
    }

    if (!addressesMatch(transfer.destination, expectedTo)) {
      return false
    }

    const decimals = 6
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
