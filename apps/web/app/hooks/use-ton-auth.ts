import { useTonWallet, useIsConnectionRestored } from '@tonconnect/ui-react';

/**
 * Hook to get TON wallet connection state
 * The actual auth logic is handled by TonAuthProvider
 */
export function useTonAuth() {
  const wallet = useTonWallet();
  const isConnectionRestored = useIsConnectionRestored();

  return {
    wallet,
    isConnected: !!wallet,
    isConnectionRestored,
  };
}
