import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientOnly } from '@/components/ClientOnly';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useAuth, useTelegram } from '@/providers';

function UserProfileInner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme, isTelegram } = useTelegram();
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const initials = useMemo(() => {
    if (!user) return '?';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';

    return (first + last).toUpperCase() || '?';
  }, [user]);

  const fullName = useMemo(() => {
    if (!user) return 'Guest';

    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }, [user]);

  const shortenAddress = (address: string) => {
    if (address.length < 12) return address;

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnectWallet = () => {
    void tonConnectUI.openModal();
  };

  const handleDisconnectWallet = () => {
    void tonConnectUI.disconnect();
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">{t('profile.title')}</h2>

      {/* User Card */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {user?.photoUrl && <AvatarImage src={user.photoUrl} alt={fullName} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <TextTrimmer text={fullName} maxLength={20} className="text-lg font-semibold" />
            {user?.username && <p className="text-muted-foreground text-sm">@{user.username}</p>}
            {user?.id && <p className="text-muted-foreground font-mono text-xs">ID: {user.id}</p>}
          </div>
        </div>

        {/* Premium Badge */}
        {user?.isPremium && (
          <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-sm text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <span>⭐</span>
            <span>{t('profile.telegramPremium')}</span>
          </div>
        )}
      </div>

      {/* Wallet Section */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="mb-4 font-semibold">{t('profile.tonWallet')}</h3>

        {wallet ? (
          <div className="space-y-3">
            <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                <span className="text-xl">💎</span>
              </div>
              <div className="min-w-0 flex-1">
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison */}
                <p className="truncate font-medium">{wallet.account.chain === '-239' ? t('profile.mainnet') : t('profile.testnet')}</p>
                <p className="text-muted-foreground font-mono text-sm">{shortenAddress(wallet.account.address)}</p>
              </div>
            </div>

            <button
              onClick={handleDisconnectWallet}
              className="w-full rounded-lg border border-red-200 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {t('profile.disconnectWallet')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">{t('profile.connectWalletDescription')}</p>

            <button
              onClick={handleConnectWallet}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span>💎</span>
              {t('profile.connectWallet')}
            </button>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="mb-4 font-semibold">{t('profile.appInfo')}</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('profile.platform')}</span>
            <span>{isTelegram ? t('profile.telegramMiniApp') : t('profile.webBrowser')}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('profile.theme')}</span>
            <span className="capitalize">{theme.colorScheme}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('profile.language')}</span>
            <span>{user?.languageCode?.toUpperCase() || 'EN'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('profile.version')}</span>
            <span>1.0.0</span>
          </div>
        </div>
      </div>

      {/* Theme Preview */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="mb-4 font-semibold">{t('profile.themeColors')}</h3>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.backgroundColor }} />
            <span className="text-xs">{t('profile.background')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.textColor }} />
            <span className="text-xs">{t('profile.text')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.buttonColor }} />
            <span className="text-xs">{t('profile.button')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.linkColor }} />
            <span className="text-xs">{t('profile.link')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.hintColor }} />
            <span className="text-xs">{t('profile.hint')}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded border" style={{ backgroundColor: theme.secondaryBackgroundColor }} />
            <span className="text-xs">{t('profile.secondary')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapped component that only renders on client to avoid SSR errors with TonConnect
export function UserProfile() {
  return (
    <ClientOnly
      fallback={
        <div className="space-y-6 p-4">
          <h2 className="text-xl font-bold">Profile</h2>
          <div className="bg-card animate-pulse rounded-lg border p-6">
            <div className="flex items-center gap-4">
              <div className="bg-muted h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-32 rounded" />
                <div className="bg-muted h-3 w-24 rounded" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <UserProfileInner />
    </ClientOnly>
  );
}
