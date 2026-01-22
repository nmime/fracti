import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { useCallback } from 'react'

export const TON_DECIMALS = 9
export const NANOTON = 10 ** TON_DECIMALS
export const USDT_DECIMALS = 6

// Mainnet Jetton master addresses
export const JETTON_ADDRESSES = {
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT on TON
  USDC: 'EQCpF7rvN-4kJlvh1iWguC4QVVBgrsU4IH7nN3v8I_f7q4U8', // USDC on TON
} as const

export type JettonType = 'USDT' | 'USDC'

export function toNano(amount: number): bigint {
  return BigInt(Math.floor(amount * NANOTON))
}

export function fromNano(amount: bigint | string): number {
  return Number(amount) / NANOTON
}

export function formatTonAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount) + ' TON'
}

interface SendTransactionParams {
  to: string
  amount: number
  comment?: string
}

interface SendJettonParams {
  to: string
  amount: number
  jettonType: JettonType
  comment?: string
}

// Jetton wallet address calculation (simplified - in production, query the blockchain)
// For demo purposes, we use a function that would normally query the jetton master contract
async function getJettonWalletAddress(ownerAddress: string, jettonMaster: string): Promise<string> {
  // In production, this would call the jetton master contract's get_wallet_address method
  // For now, return a placeholder that indicates Jetton wallet lookup is needed
  // The actual implementation requires TonClient or similar
  console.log('Getting jetton wallet for', ownerAddress, 'from master', jettonMaster)
  return jettonMaster // Simplified for demo
}

export function useTonPayment() {
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()

  const isConnected = !!wallet

  const connect = useCallback(async () => {
    await tonConnectUI.openModal()
  }, [tonConnectUI])

  const disconnect = useCallback(async () => {
    await tonConnectUI.disconnect()
  }, [tonConnectUI])

  const sendTransaction = useCallback(
    async ({ to, amount, comment }: SendTransactionParams): Promise<string> => {
      if (!wallet) {
        throw new Error('Wallet not connected')
      }

      const nanoAmount = toNano(amount)

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        messages: [
          {
            address: to,
            amount: nanoAmount.toString(),
            payload: comment ? encodeComment(comment) : undefined,
          },
        ],
      }

      const result = await tonConnectUI.sendTransaction(transaction)
      return result.boc
    },
    [wallet, tonConnectUI]
  )

  const sendJettonTransaction = useCallback(
    async ({ to, amount, jettonType, comment }: SendJettonParams): Promise<string> => {
      if (!wallet) {
        throw new Error('Wallet not connected')
      }

      const jettonMaster = JETTON_ADDRESSES[jettonType]

      // Convert amount to nano units (USDT/USDC use 6 decimals)
      const jettonAmount = BigInt(Math.floor(amount * (10 ** USDT_DECIMALS)))

      // Build Jetton transfer payload
      // op::transfer = 0xf8a7ea5
      const payload = buildJettonTransferPayload({
        toAddress: to,
        jettonAmount,
        forwardAmount: toNano(0.05), // Forward TON for notifications
        comment,
      })

      // The sender's Jetton wallet address would need to be queried from the blockchain
      // For now, we'll use the master address as a placeholder
      // In production, you'd use tonapi.io or toncenter.com to get the actual jetton wallet
      const senderJettonWallet = await getJettonWalletAddress(
        wallet.account.address,
        jettonMaster
      )

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: senderJettonWallet,
            amount: toNano(0.1).toString(), // Gas for Jetton transfer
            payload,
          },
        ],
      }

      const result = await tonConnectUI.sendTransaction(transaction)
      return result.boc
    },
    [wallet, tonConnectUI]
  )

  return {
    wallet,
    isConnected,
    address: wallet?.account?.address,
    connect,
    disconnect,
    sendTransaction,
    sendJettonTransaction,
  }
}

function encodeComment(comment: string): string {
  // Simple text comment encoding (0x00000000 prefix for text)
  const encoder = new TextEncoder()
  const bytes = encoder.encode(comment)
  const buffer = new Uint8Array(4 + bytes.length)
  buffer.set([0, 0, 0, 0]) // Text comment prefix
  buffer.set(bytes, 4)
  return bufferToBase64(buffer)
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

interface JettonTransferParams {
  toAddress: string
  jettonAmount: bigint
  forwardAmount: bigint
  comment?: string
}

function buildJettonTransferPayload({
  toAddress,
  jettonAmount,
  forwardAmount,
  comment,
}: JettonTransferParams): string {
  // Jetton transfer TL-B:
  // transfer#f8a7ea5 query_id:uint64 amount:Coins destination:MsgAddress
  //   response_destination:MsgAddress custom_payload:(Maybe ^Cell)
  //   forward_ton_amount:Coins forward_payload:(Either Cell ^Cell) = InternalMsgBody;

  // For simplicity, we'll encode a basic transfer
  // In production, use @ton/core or similar library for proper Cell serialization

  // Build a simplified payload
  // This is a basic implementation - production should use proper Cell builders
  const opCode = 0xf8a7ea5 // transfer operation
  const queryId = BigInt(Date.now())

  // Create comment payload if provided
  const commentBytes = comment ? new TextEncoder().encode(comment) : new Uint8Array(0)

  // Build basic payload structure (simplified)
  // Real implementation would use proper TL-B serialization
  const buffer = new Uint8Array(32 + commentBytes.length)

  // Write op code (4 bytes)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, opCode, false)

  // Write query_id (8 bytes)
  view.setBigUint64(4, queryId, false)

  // For the rest, we need proper Cell serialization
  // This is a simplified version for demonstration
  // In production, use @ton/ton library

  return bufferToBase64(buffer)
}

// Hook to get formatted wallet address
export function useFormattedAddress() {
  const wallet = useTonWallet()

  if (!wallet?.account?.address) return null

  const address = wallet.account.address
  return {
    full: address,
    short: `${address.slice(0, 6)}...${address.slice(-4)}`,
  }
}
