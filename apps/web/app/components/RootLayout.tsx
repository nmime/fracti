import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import {
  Home,
  Receipt,
  Wallet,
  Camera,
  BarChart3,
  RefreshCw,
  MoreHorizontal,
  X,
  Menu,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/utils'
import { useTelegram, useGroup } from '@/providers'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
  { path: '/scan', icon: Camera, labelKey: 'nav.scan' },
  { path: '/settle', icon: Wallet, labelKey: 'nav.settle' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { path: '/recurring', icon: RefreshCw, labelKey: 'nav.recurring' },
] as const

const mobileNavItems = navItems.slice(0, 4)
const moreNavItems = navItems.slice(4)

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isReady, isTelegram } = useTelegram()
  const { group } = useGroup()
  const { t } = useTranslation()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const isMoreActive = moreNavItems.some((item) => location.pathname === item.path)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-card">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">F</span>
          </div>
          <span className="text-xl font-semibold">Fracti</span>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map(({ path, icon: Icon, labelKey }) => {
              const isActive = location.pathname === path
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {group ? group.title : t('userDashboard.subtitle')}
            </span>
            <ThemeToggle variant="dropdown" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Mobile/Tablet Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">F</span>
              </div>
              <span className="font-semibold">Fracti</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle variant="icon" />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              {/* Tablet: show analytics/recurring buttons */}
              <div className="hidden md:flex items-center gap-1">
                {moreNavItems.map(({ path, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={cn(
                      'rounded-lg p-2 transition-colors',
                      location.pathname === path
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-40 h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
          <div>
            {group && (
              <h1 className="text-lg font-semibold">{group.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="dropdown" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div
              className="absolute inset-y-0 right-0 w-64 bg-background shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-between border-b px-4">
                <span className="font-semibold">{t('nav.more')}</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="p-4">
                <div className="space-y-1">
                  {navItems.map(({ path, icon: Icon, labelKey }) => {
                    const isActive = location.pathname === path
                    return (
                      <button
                        key={path}
                        onClick={() => {
                          navigate(path)
                          setIsMobileMenuOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {t(labelKey)}
                      </button>
                    )
                  })}
                </div>
              </nav>
            </div>
          </div>
        )}

        {/* More Menu Overlay (Tablet) */}
        {isMoreOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setIsMoreOpen(false)}
          >
            <div
              className="absolute bottom-20 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">{t('nav.more')}</span>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
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

        {/* Bottom Navigation - Mobile only */}
        <nav className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden safe-area-inset-bottom">
          <div className="flex h-16 items-center justify-around px-2">
            {mobileNavItems.map(({ path, icon: Icon, labelKey }) => {
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

        {/* Tablet Bottom Navigation */}
        <nav className="hidden md:flex lg:hidden sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
          <div className="flex h-16 w-full items-center justify-around px-4">
            {mobileNavItems.map(({ path, icon: Icon, labelKey }) => {
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
          </div>
        </nav>
      </div>
    </div>
  )
}
