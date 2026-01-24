import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
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
 * Shows an error if not authenticated
 */
export function RequireAuth({
  children,
  fallback
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isAuthenticated, isLoading, error, loginWithWidget } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Authenticating...</p>
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Welcome to Fracti</h1>
          <p className="text-muted-foreground mb-6">
            Sign in with your Telegram account to continue
          </p>

          {error && (
            <p className="text-sm text-red-500 mb-4">{error}</p>
          )}

          <TelegramWidgetLogin onAuth={handleWidgetAuth} />

          <p className="text-sm text-muted-foreground mt-6">
            Or open directly in{' '}
            <a href="https://t.me/FractiBot/app" className="text-primary hover:underline">
              Telegram
            </a>
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
