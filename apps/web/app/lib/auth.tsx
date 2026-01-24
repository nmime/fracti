import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Users, Receipt, Sparkles } from 'lucide-react'
import { api, type AuthUser, type TelegramWidgetData } from './api'
import { useTelegram } from './telegram'
import { logger } from './logger'

interface AuthContextValue {
  // Auth state
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  authMethod: 'init_data' | 'widget' | null

  // Actions
  refreshAuth: () => Promise<void>
  logout: () => void

  // Widget auth (for external login flows)
  loginWithWidget: (widgetData: TelegramWidgetData) => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const telegram = useTelegram()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'init_data' | 'widget' | null>(null)

  // Initialize API client with Telegram initData when available
  useEffect(() => {
    if (telegram.initData) {
      api.setInitData(telegram.initData)
      logger.debug('API client initialized with Telegram initData', {
        hasInitData: !!telegram.initData,
        isTelegram: telegram.isTelegram,
      })
    }
  }, [telegram.initData, telegram.isTelegram])

  // Verify authentication when Telegram context is ready
  useEffect(() => {
    if (!telegram.isReady) {
      return
    }

    const verifyAuth = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // If we have initData and are in Telegram, verify auth with backend
        if (telegram.initData && telegram.isTelegram) {
          const response = await api.verifyAuth()
          setUser(response.user)
          setIsAuthenticated(true)
          setAuthMethod(response.authMethod as 'init_data' | 'widget')
          logger.info('Auth verified successfully', {
            userId: response.user.id,
            authMethod: response.authMethod,
          })
        } else {
          // Not in Telegram context - no authentication
          setIsAuthenticated(false)
          setUser(null)
          setAuthMethod(null)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed'
        logger.error('Auth verification failed', { error: err })
        setError(message)
        setIsAuthenticated(false)
        setUser(null)
        setAuthMethod(null)
      } finally {
        setIsLoading(false)
      }
    }

    verifyAuth()
  }, [telegram.isReady, telegram.initData, telegram.isTelegram])

  // Refresh auth manually
  const refreshAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.verifyAuth()
      setUser(response.user)
      setIsAuthenticated(true)
      setAuthMethod(response.authMethod as 'init_data' | 'widget')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message)
      setIsAuthenticated(false)
      setUser(null)
      setAuthMethod(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout (clear local state)
  const logout = useCallback(() => {
    setUser(null)
    setIsAuthenticated(false)
    setAuthMethod(null)
    setError(null)
    logger.info('User logged out')
  }, [])

  // Login with Telegram Widget (for external web flows)
  const loginWithWidget = useCallback(async (widgetData: TelegramWidgetData): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.authWithWidget(widgetData)

      // Set widget data for future API calls
      api.setWidgetData(widgetData)

      setUser(response.user)
      setIsAuthenticated(true)
      setAuthMethod('widget')

      logger.info('Widget auth successful', {
        userId: response.user.id,
      })

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Widget authentication failed'
      setError(message)
      logger.error('Widget auth failed', { error: err })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Memoize context value
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated,
    isLoading,
    error,
    authMethod,
    refreshAuth,
    logout,
    loginWithWidget,
  }), [user, isAuthenticated, isLoading, error, authMethod, refreshAuth, logout, loginWithWidget])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Telegram Widget Login component for browser authentication
 */
function TelegramWidgetLogin({ onAuth }: { onAuth: (data: TelegramWidgetData) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Set up global callback for Telegram Widget
    (window as unknown as Record<string, unknown>).TelegramLoginWidgetDataOnauth = (user: TelegramWidgetData) => {
      onAuth(user)
    }

    // Create and inject widget script
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', 'FractiBot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'TelegramLoginWidgetDataOnauth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true

    containerRef.current?.appendChild(script)

    return () => {
      delete (window as unknown as Record<string, unknown>).TelegramLoginWidgetDataOnauth
    }
  }, [onAuth])

  return <div ref={containerRef} className="flex justify-center" />
}

/**
 * Higher-order component to require authentication
 * Shows a polished welcome screen for browser users
 */
export function RequireAuth({
  children,
  fallback
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { isAuthenticated, isLoading, error, loginWithWidget } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">F</span>
          </div>
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-3" />
          <p className="text-muted-foreground">{t('auth.authenticating')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>
    }

    const handleWidgetAuth = async (widgetData: TelegramWidgetData) => {
      await loginWithWidget(widgetData)
    }

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Logo */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary mb-6 shadow-lg">
            <span className="text-3xl font-bold text-primary-foreground">F</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold mb-2">{t('auth.welcome')}</h1>
          <p className="text-muted-foreground text-center max-w-sm mb-8">
            {t('auth.subtitle')}
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900 p-2">
                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.track')}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="rounded-lg bg-green-100 dark:bg-green-900 p-2">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.split')}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="rounded-lg bg-purple-100 dark:bg-purple-900 p-2">
                <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.settle')}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
              <div className="rounded-lg bg-orange-100 dark:bg-orange-900 p-2">
                <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.ai')}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 w-full max-w-sm">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            </div>
          )}

          {/* Login Widget */}
          <div className="w-full max-w-sm">
            <TelegramWidgetLogin onAuth={handleWidgetAuth} />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6 w-full max-w-sm">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Telegram App Link */}
          <a
            href="https://t.me/FractiBot/app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <svg className="h-5 w-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            <span className="font-medium">{t('auth.openInTelegram')}</span>
          </a>
        </div>

        {/* Footer */}
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">
            {t('auth.footer')}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
