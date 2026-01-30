import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Camera from 'lucide-react/dist/esm/icons/camera';
import Home from 'lucide-react/dist/esm/icons/home';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useTelegram, useGroup } from '@/providers';
import { cn } from '@/utils';

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
  { path: '/scan', icon: Camera, labelKey: 'nav.scan' },
  { path: '/settle', icon: Wallet, labelKey: 'nav.settle' },
  { path: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { path: '/recurring', icon: RefreshCw, labelKey: 'nav.recurring' },
] as const;

const mobileNavItems = navItems.slice(0, 4);
const moreNavItems = navItems.slice(4);

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isReady } = useTelegram();
  const { group } = useGroup();
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (!isReady) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  const isMoreActive = moreNavItems.some((item) => location.pathname === item.path);

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden lg:flex-row">
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="lg:bg-card hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <span className="text-primary-foreground text-lg font-bold">F</span>
          </div>
          <span className="text-xl font-semibold">Fracti</span>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map(({ path, icon: Icon, labelKey }) => {
              const isActive = location.pathname === path;

              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {group ? <TextTrimmer text={group.title} maxLength={18} /> : t('userDashboard.subtitle')}
            </span>
            <div className="flex items-center gap-1">
              <LanguageSwitcher variant="dropdown" />
              <ThemeToggle variant="dropdown" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-col lg:pl-64">
        {/* Mobile/Tablet Header */}
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 safe-area-inset-top sticky top-0 z-40 border-b backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-primary-foreground text-sm font-bold">F</span>
              </div>
              <span className="font-semibold">Fracti</span>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher variant="icon" />
              <ThemeToggle variant="icon" />
              {/* Tablet: show analytics/recurring buttons */}
              <div className="hidden items-center gap-1 md:flex">
                {moreNavItems.map(({ path, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className={cn(
                      'rounded-lg p-2 transition-colors',
                      location.pathname === path
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted',
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
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 hidden h-16 items-center justify-between border-b px-6 backdrop-blur lg:flex">
          <div>{group && <h1 className="text-lg font-semibold"><TextTrimmer text={group.title} maxLength={30} /></h1>}</div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="dropdown" />
            <ThemeToggle variant="dropdown" />
          </div>
        </header>

        {/* Main Content */}
        <main className="bg-background min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* More Menu - Popover */}
        {isMoreOpen && (
          <>
            <div
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => {
                setIsMoreOpen(false);
              }}
            />
            <div className="bg-popover text-popover-foreground fixed right-4 bottom-20 z-50 min-w-40 overflow-hidden rounded-lg border shadow-lg md:hidden">
              {moreNavItems.map(({ path, icon: Icon, labelKey }) => {
                const isActive = location.pathname === path;

                return (
                  <button
                    key={path}
                    onClick={() => {
                      void navigate(path);
                      setIsMoreOpen(false);
                    }}
                    className={cn(
                      'hover:bg-accent flex w-full items-center gap-3 px-4 py-2.5 text-sm',
                      isActive && 'bg-accent text-primary',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Bottom Navigation - Mobile only */}
        <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom sticky bottom-0 z-40 border-t backdrop-blur md:hidden">
          <div className="flex h-16 items-center justify-around px-2">
            {mobileNavItems.map(({ path, icon: Icon, labelKey }) => {
              const isActive = location.pathname === path;

              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                setIsMoreOpen((prev) => !prev);
              }}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                isMoreActive || isMoreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <MoreHorizontal className={cn('h-5 w-5', (isMoreActive || isMoreOpen) && 'text-primary')} />
              <span>{t('nav.more')}</span>
            </button>
          </div>
        </nav>

        {/* Tablet Bottom Navigation */}
        <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom sticky bottom-0 z-40 hidden border-t backdrop-blur md:flex lg:hidden">
          <div className="flex h-16 w-full items-center justify-around px-4">
            {mobileNavItems.map(({ path, icon: Icon, labelKey }) => {
              const isActive = location.pathname === path;

              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
