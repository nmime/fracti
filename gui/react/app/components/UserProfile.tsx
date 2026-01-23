import { useMemo } from 'react'
import { useTelegram } from '@/lib/telegram'
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function UserProfile() {
  const { user, theme, isTelegram } = useTelegram()
  const wallet = useTonWallet()
  const [tonConnectUI] = useTonConnectUI()

  const initials = useMemo(() => {
    if (!user) return '?'
    const first = user.first_name?.[0] || ''
    const last = user.last_name?.[0] || ''
    return (first + last).toUpperCase() || '?'
  }, [user])

  const fullName = useMemo(() => {
    if (!user) return 'Guest'
    return [user.first_name, user.last_name].filter(Boolean).join(' ')
  }, [user])

  const shortenAddress = (address: string) => {
    if (address.length < 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const handleConnectWallet = () => {
    tonConnectUI.openModal()
  }

  const handleDisconnectWallet = () => {
    tonConnectUI.disconnect()
  }

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">Profile</h2>

      {/* User Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20">
            {user?.photo_url && <AvatarImage src={user.photo_url} alt={fullName} />}
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{fullName}</h3>
            {user?.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            {user?.id && (
              <p className="text-xs text-muted-foreground font-mono">
                ID: {user.id}
              </p>
            )}
          </div>
        </div>

        {/* Premium Badge */}
        {user && 'is_premium' in user && (user as { is_premium?: boolean }).is_premium && (
          <div className="mt-4 inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
            <span>⭐</span>
            <span>Telegram Premium</span>
          </div>
        )}
      </div>

      {/* Wallet Section */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-4">TON Wallet</h3>

        {wallet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl">💎</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {wallet.account.chain === '-239' ? 'Mainnet' : 'Testnet'}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {shortenAddress(wallet.account.address)}
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnectWallet}
              className="w-full py-2 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your TON wallet to send and receive payments
            </p>

            <button
              onClick={handleConnectWallet}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <span>💎</span>
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-4">App Info</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform</span>
            <span>{isTelegram ? 'Telegram Mini App' : 'Web Browser'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Theme</span>
            <span className="capitalize">{theme.colorScheme}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Language</span>
            <span>{user?.language_code?.toUpperCase() || 'EN'}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>1.0.0</span>
          </div>
        </div>
      </div>

      {/* Theme Preview */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold mb-4">Theme Colors</h3>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.backgroundColor }}
            />
            <span className="text-xs">Background</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.textColor }}
            />
            <span className="text-xs">Text</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.buttonColor }}
            />
            <span className="text-xs">Button</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.linkColor }}
            />
            <span className="text-xs">Link</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.hintColor }}
            />
            <span className="text-xs">Hint</span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded border"
              style={{ backgroundColor: theme.secondaryBackgroundColor }}
            />
            <span className="text-xs">Secondary</span>
          </div>
        </div>
      </div>
    </div>
  )
}
