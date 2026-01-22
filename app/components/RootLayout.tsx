import { Outlet, useLocation, useNavigate } from 'react-router'
import { Home, Receipt, Wallet, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTelegram } from '@/lib/telegram'

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/expenses', icon: Receipt, label: 'Expenses' },
  { path: '/scan', icon: Camera, label: 'Scan' },
  { path: '/settle', icon: Wallet, label: 'Settle' },
]

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isReady, theme } = useTelegram()

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col tg-viewport"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">F</span>
            </div>
            <span className="font-semibold">Fracti</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
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
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
