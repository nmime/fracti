import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react';
import { Address, beginCell, toNano as tonCoreToNano } from '@ton/core';
import { storeJettonTransferMessage } from '@ton-community/assets-sdk';
import { useCallback } from 'react';
import {
  JETTON_ADDRESSES,
  type JettonType,
  NANOTON,
  TON_DECIMALS,
  USDT_DECIMALS,
  TONCENTER_API_URL,
} from '../constants/ton';
import { api } from '../services/api';
import { logger } from '../utils/logger';

// Transaction validity duration (5 minutes - TonConnect SDK warns if > 5 min)
const TX_VALID_SECONDS = 300;

/**
 * TON Payment Hook - Handles TON and USDT payments via TON Connect
 */

export function toNano(amount: number): bigint {
  return BigInt(Math.floor(amount * NANOTON));
}

export function fromNano(amount: bigint | string): number {
  return Number(amount) / NANOTON;
}

export function formatTonAmount(amount: number): string {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)} TON`;
}

interface SendTransactionParams {
  to: string;
  amount: number;
  comment?: string;
}

interface SendJettonParams {
  to: string;
  amount: number;
  jettonType: JettonType;
  comment?: string;
}

/**
 * Get the user's jetton wallet address using TON Center API
 * Each user has their own jetton wallet contract derived from owner + master
 */
async function getJettonWalletAddress(ownerAddress: string, jettonMaster: string): Promise<string> {
  logger.debug('Getting jetton wallet address', { ownerAddress, jettonMaster });

  try {
    const url = new URL(`${TONCENTER_API_URL}/jetton/wallets`);
    url.searchParams.set('owner_address', ownerAddress);
    url.searchParams.set('jetton_address', jettonMaster);
    url.searchParams.set('limit', '1');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`TON Center API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      jetton_wallets?: Array<{ address: string }>;
    };

    if (!data.jetton_wallets || data.jetton_wallets.length === 0) {
      throw new Error('Jetton wallet not found. You may need to receive USDT first.');
    }

    const walletAddress = data.jetton_wallets[0].address;
    logger.debug('Found jetton wallet', { walletAddress });

    return walletAddress;
  } catch (error) {
    logger.error('Failed to get jetton wallet address', { ownerAddress, jettonMaster }, error as Error);
    throw error;
  }
}

/**
 * Build jetton transfer payload using @ton-community/assets-sdk
 * This is the recommended approach matching the TonConnect demo
 * https://github.com/ton-connect/demo-dapp-with-react-ui
 */
function buildJettonTransferPayload(
  toAddress: string,
  jettonAmount: bigint,
  forwardTonAmount: bigint,
  responseAddress: string,
  comment?: string,
): string {
  // Build forward payload (comment) if provided
  const forwardPayload = comment
    ? beginCell()
        .storeUint(0, 32) // Text comment op code
        .storeStringTail(comment)
        .endCell()
    : null;

  // Use the assets-sdk to build the transfer message (same as TonConnect demo)
  // queryId: 0n matches the demo exactly
  const body = beginCell();
  storeJettonTransferMessage({
    queryId: 0n,
    amount: jettonAmount,
    destination: Address.parse(toAddress),
    responseDestination: Address.parse(responseAddress),
    customPayload: null, // No custom payload
    forwardAmount: forwardTonAmount,
    forwardPayload: forwardPayload,
  })(body);

  return body.endCell().toBoc().toString('base64');
}

/**
 * Encode a simple text comment for TON transfer
 */
function encodeComment(comment: string): string {
  const body = beginCell()
    .storeUint(0, 32) // Text comment op code (0x00000000)
    .storeStringTail(comment)
    .endCell();

  return body.toBoc().toString('base64');
}

export function useTonPayment() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const isConnected = !!wallet;

  const connect = useCallback(async () => {
    await tonConnectUI.openModal();
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    await tonConnectUI.disconnect();
    // Clean up backend session
    if (api.hasAuth()) {
      try {
        await api.deleteTonConnectSession();
        logger.info('TON Connect session deleted from backend');
      } catch (error) {
        logger.warn('Failed to delete TON Connect session from backend', {}, error as Error);
      }
    }
  }, [tonConnectUI]);

  /**
   * Send native TON transaction
   */
  const sendTransaction = useCallback(
    async ({ to, amount, comment }: SendTransactionParams): Promise<string> => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      const nanoAmount = toNano(amount);

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + TX_VALID_SECONDS,
        messages: [
          {
            address: to,
            amount: nanoAmount.toString(),
            payload: comment ? encodeComment(comment) : undefined,
          },
        ],
      };

      logger.info('Sending TON transaction', { to, amount, comment, validUntil: transaction.validUntil });
      logger.debug('TonConnectUI state', {
        connected: tonConnectUI.connected,
        wallet: tonConnectUI.wallet?.account.address,
      });

      try {
        const result = await tonConnectUI.sendTransaction(transaction);
        logger.info('TON transaction sent successfully', { boc: result.boc.slice(0, 50) + '...' });
        return result.boc;
      } catch (txError) {
        logger.error('TON transaction failed in sendTransaction', { error: txError });
        throw txError;
      }
    },
    [wallet, tonConnectUI],
  );

  /**
   * Send USDT (Jetton) transaction
   */
  const sendJettonTransaction = useCallback(
    async ({ to, amount, jettonType, comment }: SendJettonParams): Promise<string> => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      const jettonMaster = JETTON_ADDRESSES[jettonType];
      if (!jettonMaster) {
        throw new Error(`Unknown jetton type: ${jettonType}`);
      }

      // Convert amount to smallest units (6 decimals for USDT)
      const jettonAmount = BigInt(Math.floor(amount * 10 ** USDT_DECIMALS));

      // Forward TON amount for the internal message (matching TonConnect demo: 0.001 TON)
      const forwardTonAmount = tonCoreToNano('0.001');

      // Get sender's jetton wallet address from TON Center
      const senderJettonWallet = await getJettonWalletAddress(wallet.account.address, jettonMaster);

      // Build the jetton transfer payload using assets-sdk
      const payload = buildJettonTransferPayload(
        to,
        jettonAmount,
        forwardTonAmount,
        wallet.account.address, // Response goes back to sender
        comment,
      );

      // Gas fee in TON (matching TonConnect demo: 0.05 TON)
      const gasAmount = tonCoreToNano('0.05');

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + TX_VALID_SECONDS,
        messages: [
          {
            address: senderJettonWallet,
            amount: gasAmount.toString(),
            payload,
          },
        ],
      };

      logger.info('Sending USDT transaction', {
        to,
        amount,
        jettonType,
        senderJettonWallet,
        validUntil: transaction.validUntil,
        gasAmount: gasAmount.toString(),
      });
      logger.debug('TonConnectUI state for USDT', {
        connected: tonConnectUI.connected,
        wallet: tonConnectUI.wallet?.account.address,
      });

      try {
        const result = await tonConnectUI.sendTransaction(transaction);
        logger.info('USDT transaction sent successfully', { boc: result.boc.slice(0, 50) + '...' });
        return result.boc;
      } catch (txError) {
        logger.error('USDT transaction failed in sendTransaction', { error: txError });
        throw txError;
      }
    },
    [wallet, tonConnectUI],
  );

  return {
    wallet,
    isConnected,
    address: wallet?.account?.address,
    connect,
    disconnect,
    sendTransaction,
    sendJettonTransaction,
  };
}

export function useFormattedAddress() {
  // useTonAddress returns user-friendly format by default (UQ...)
  const userFriendlyAddress = useTonAddress();

  if (!userFriendlyAddress) return null;

  return {
    full: userFriendlyAddress,
    short: `${userFriendlyAddress.slice(0, 4)}...${userFriendlyAddress.slice(-4)}`,
  };
}

export { TON_DECIMALS, NANOTON, USDT_DECIMALS, JETTON_ADDRESSES, type JettonType };
