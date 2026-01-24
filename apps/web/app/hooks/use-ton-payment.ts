import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { useCallback } from 'react'
import { TON_DECIMALS, NANOTON, USDT_DECIMALS, JETTON_ADDRESSES, type JettonType } from '../constants/ton'

/**
 * TON Payment Hook
 */

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

async function getJettonWalletAddress(ownerAddress: string, jettonMaster: string): Promise<string> {
  console.log('Getting jetton wallet for', ownerAddress, 'from master', jettonMaster)
  return jettonMaster
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
        validUntil: Math.floor(Date.now() / 1000) + 600,
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
      const jettonAmount = BigInt(Math.floor(amount * (10 ** USDT_DECIMALS)))

      const payload = buildJettonTransferPayload({
        toAddress: to,
        jettonAmount,
        forwardAmount: toNano(0.05),
        comment,
      })

      const senderJettonWallet = await getJettonWalletAddress(
        wallet.account.address,
        jettonMaster
      )

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: senderJettonWallet,
            amount: toNano(0.1).toString(),
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
  const encoder = new TextEncoder()
  const bytes = encoder.encode(comment)
  const buffer = new Uint8Array(4 + bytes.length)
  buffer.set([0, 0, 0, 0])
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
  toAddress: _toAddress,
  jettonAmount: _jettonAmount,
  forwardAmount: _forwardAmount,
  comment,
}: JettonTransferParams): string {
  const opCode = 0xf8a7ea5
  const queryId = BigInt(Date.now())
  const commentBytes = comment ? new TextEncoder().encode(comment) : new Uint8Array(0)
  const buffer = new Uint8Array(32 + commentBytes.length)
  const view = new DataView(buffer.buffer)
  view.setUint32(0, opCode, false)
  view.setBigUint64(4, queryId, false)
  return bufferToBase64(buffer)
}

export function useFormattedAddress() {
  const wallet = useTonWallet()

  if (!wallet?.account?.address) return null

  const address = wallet.account.address
  return {
    full: address,
    short: `${address.slice(0, 6)}...${address.slice(-4)}`,
  }
}

export { TON_DECIMALS, NANOTON, USDT_DECIMALS, JETTON_ADDRESSES, type JettonType }
