// This file is only loaded on the client (due to .client.tsx suffix)
import { THEME, TonConnectUIProvider } from '@tonconnect/ui-react';
import type { ReactNode } from 'react';
import { tonConfig } from '@/config';

// For Telegram Mini Apps, use the direct link back to the app
const TMA_RETURN_URL = 'https://t.me/fractibot/app';

/**
 * Minimal TonConnect Provider - just wraps TonConnectUIProvider
 * Matching the demo pattern exactly
 */
export function TonConnectProvider({ children }: { children: ReactNode }) {
  // Check if running inside Telegram Mini App
  const isTMA = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

  return (
    <TonConnectUIProvider
      manifestUrl={tonConfig.manifestUrl}
      uiPreferences={{
        theme: THEME.DARK,
      }}
      actionsConfiguration={{
        twaReturnUrl: isTMA ? TMA_RETURN_URL : undefined,
      }}
    >
      {children}
    </TonConnectUIProvider>
  );
}
