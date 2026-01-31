import { TonConnectButton } from '@tonconnect/ui-react';
import { ClientOnly } from '@/components/ClientOnly';
import { Button } from '@/components/ui/button';
import Wallet from 'lucide-react/dist/esm/icons/wallet';

// Use TonConnectButton directly from SDK to isolate any issues
export function WalletButton() {
  return (
    <ClientOnly
      fallback={
        <Button variant="outline" className="gap-2" disabled>
          <Wallet className="h-4 w-4" />
          <span className="border-primary h-4 w-4 rounded-full border-2 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
        </Button>
      }
    >
      <TonConnectButton />
    </ClientOnly>
  );
}
