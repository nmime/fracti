import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { useCallback } from 'react'

export const TON_DECIMALS = 9
export const NANOTON = 10 ** TON_DECIMALS

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

  return {
    wallet,
    isConnected,
    address: wallet?.account?.address,
    connect,
    disconnect,
    sendTransaction,
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
