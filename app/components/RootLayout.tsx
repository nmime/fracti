import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Home, Receipt, Wallet, Camera, BarChart3, RefreshCw, MoreHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useTelegram } from '@/lib/telegram'
import { ThemeToggle } from '@/components/ThemeToggle'

const mainNavItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
  { path: '/scan', icon: Camera, labelKey: 'nav.scan' },
  { path: '/settle', icon: Wallet, labelKey: 'nav.settle' },
] as const

const moreNavItems = [
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { path: '/recurring', icon: RefreshCw, labelKey: 'nav.recurring' },
] as const

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isReady, theme } = useTelegram()
  const { t } = useTranslation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const isMoreActive = moreNavItems.some((item) => location.pathname === item.path)

  return (
    <div
      className="flex min-h-screen flex-col tg-viewport"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">F</span>
            </div>
            <span className="font-semibold">Fracti</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => navigate('/analytics')}
              className={cn(
                'rounded-lg p-2 transition-colors',
                location.pathname === '/analytics' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <BarChart3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/recurring')}
              className={cn(
                'rounded-lg p-2 transition-colors',
                location.pathname === '/recurring' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* More Menu Overlay */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="absolute bottom-20 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">{t('nav.more')}</span>
              <button onClick={() => setIsMoreOpen(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreNavItems.map(({ path, icon: Icon, labelKey }) => {
                const isActive = location.pathname === path
                return (
                  <button
                    key={path}
                    onClick={() => {
                      navigate(path)
                      setIsMoreOpen(false)
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg p-3 transition-colors',
                      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{t(labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-around px-2">
          {mainNavItems.map(({ path, icon: Icon, labelKey }) => {
            const isActive = location.pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span>{t(labelKey)}</span>
              </button>
            )
          })}
          {/* More button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
              isMoreActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className={cn('h-5 w-5', isMoreActive && 'text-primary')} />
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
