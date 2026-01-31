// This file is only loaded on the client (due to .client.tsx suffix)
import { useEffect, useRef, type ReactNode } from 'react';
import { useTonConnectUI, useIsConnectionRestored } from '@tonconnect/ui-react';
import { apiConfig } from '@/config';
import { api } from '@/services/api';
import { logger } from '@/utils/logger';
import { useAuth } from '@/providers/AuthProvider';

// TonConnect localStorage keys to sync for cross-device persistence
const STORAGE_KEY_PREFIX = 'ton-connect-storage_';
const SYNC_KEYS = ['bridge-connection', 'last-selected-wallet'];

interface TonProofPayloadResponse {
  success: boolean;
  payload: string;
  expiresAt: number;
}

/**
 * Fetch a proof payload from the backend
 */
async function fetchTonProofPayload(): Promise<string | null> {
  try {
    const response = await fetch(`${apiConfig.baseUrl}/ton-proof/payload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      logger.error('Failed to fetch TON proof payload', { status: response.status });
      return null;
    }

    const data = (await response.json()) as TonProofPayloadResponse;
    return data.success ? data.payload : null;
  } catch (error) {
    logger.error('Error fetching TON proof payload', {}, error as Error);
    return null;
  }
}

/**
 * TonAuth Provider - handles proof payload and verification
 * Uses onStatusChange pattern from TonConnect demo
 */
export function TonAuthProvider({ children }: { children: ReactNode }) {
  const [tonConnectUI] = useTonConnectUI();
  const isConnectionRestored = useIsConnectionRestored();
  const { setWallet } = useAuth();
  const initializedRef = useRef(false);

  // Initialize payload and set up status change listener ONCE
  useEffect(() => {
    console.log('[TonAuth] Effect running, isConnectionRestored:', isConnectionRestored, 'initialized:', initializedRef.current);

    if (!isConnectionRestored) {
      console.log('[TonAuth] Waiting for connection restore...');
      return;
    }
    if (initializedRef.current) {
      console.log('[TonAuth] Already initialized, skipping');
      return;
    }
    initializedRef.current = true;
    console.log('[TonAuth] Initializing...');

    // Fetch and set payload
    const initPayload = async () => {
      console.log('[TonAuth] Fetching payload...');
      const payload = await fetchTonProofPayload();
      if (payload) {
        console.log('[TonAuth] Setting connect request parameters with payload');
        tonConnectUI.setConnectRequestParameters({
          state: 'ready',
          value: { tonProof: payload },
        });
        logger.debug('TON proof payload initialized');
      } else {
        console.log('[TonAuth] No payload received');
      }
    };

    initPayload();

    // Listen for wallet status changes (matching demo pattern)
    console.log('[TonAuth] Setting up onStatusChange listener');
    const unsubscribe = tonConnectUI.onStatusChange(async (wallet) => {
      console.log('[TonAuth] onStatusChange called, wallet:', wallet ? wallet.account.address : null);
      if (!wallet) {
        // Disconnected
        setWallet(null);
        return;
      }

      // Connected - check for proof
      const tonProof = wallet.connectItems?.tonProof;

      if (tonProof && 'proof' in tonProof) {
        // Fresh connection with proof - verify it
        logger.debug('Verifying TON proof for new connection');
        try {
          const initData = window.Telegram?.WebApp?.initData;
          const response = await fetch(`${apiConfig.baseUrl}/ton-proof/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
            },
            body: JSON.stringify({
              proof: tonProof.proof,
              wallet: {
                address: wallet.account.address,
                publicKey: wallet.account.publicKey || '',
                walletStateInit: wallet.account.walletStateInit || '',
              },
            }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            logger.info('Wallet verified via TON Proof', { address: wallet.account.address });
            setWallet(wallet.account.address);

            // Sync to backend for cross-device
            if (api.hasAuth()) {
              for (const key of SYNC_KEYS) {
                const value = localStorage.getItem(STORAGE_KEY_PREFIX + key);
                if (value) {
                  await api.saveTonConnectSession({ key, value }).catch(() => {});
                }
              }
            }
          } else {
            logger.warn('TON proof verification failed', { error: data.error });
            tonConnectUI.disconnect();
          }
        } catch (error) {
          logger.error('TON proof verification error', {}, error as Error);
          tonConnectUI.disconnect();
        }
      } else {
        // Restored connection (no proof) - accept it
        logger.info('Wallet restored from session', { address: wallet.account.address });
        setWallet(wallet.account.address);
      }
    });

    return () => unsubscribe();
  }, [isConnectionRestored, tonConnectUI, setWallet]);

  return <>{children}</>;
}
