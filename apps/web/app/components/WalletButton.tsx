import LogOut from 'lucide-react/dist/esm/icons/log-out';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import { useTranslation } from 'react-i18next';
import { ClientOnly } from '@/components/ClientOnly';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { useTonPayment, useFormattedAddress } from '@/hooks';

function WalletButtonInner() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { isConnected, connect, disconnect } = useTonPayment();
  const formattedAddress = useFormattedAddress();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (_error) {
      toast({
        title: t('toast.walletConnectError.title'),
        description: t('toast.walletConnectError.description'),
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (_error) {
      toast({
        title: t('toast.walletDisconnectError.title'),
        description: t('toast.walletDisconnectError.description'),
        variant: 'destructive',
      });
    }
  };

  const handleCopyAddress = async () => {
    try {
      if (formattedAddress?.full) {
        await navigator.clipboard.writeText(formattedAddress.full);
        toast({
          title: t('toast.addressCopied.title'),
          description: t('toast.addressCopied.description'),
          variant: 'success',
        });
      }
    } catch (_error) {
      toast({
        title: t('toast.copyError.title'),
        description: t('toast.copyError.description'),
        variant: 'destructive',
      });
    }
  };

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} variant="ton" className="gap-2">
        <Wallet className="h-4 w-4" />
        {t('wallet.connect')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="text-ton h-4 w-4" />
          {formattedAddress?.short}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyAddress}>{t('wallet.copyAddress')}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t('wallet.disconnect')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Wrapped component that only renders on client to avoid SSR errors with TonConnect
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
      <WalletButtonInner />
    </ClientOnly>
  );
}
