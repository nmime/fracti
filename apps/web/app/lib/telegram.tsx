import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import WebApp from '@twa-dev/sdk'
import type { TelegramUser, TelegramTheme, DeepLinkParams } from '@core/types'

const defaultTheme: TelegramTheme = {
  colorScheme: 'light',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  hintColor: '#999999',
  linkColor: '#0088CC',
  buttonColor: '#0088CC',
  buttonTextColor: '#ffffff',
  secondaryBackgroundColor: '#f4f4f5',
}

interface TelegramContextValue {
  user: TelegramUser | null
  theme: TelegramTheme
  initData: string
  initDataUnsafe: Record<string, unknown>
  isReady: boolean
  isTelegram: boolean
  startParam: string | null
  deepLink: DeepLinkParams
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  mainButton: {
    show: () => void
    hide: () => void
    setText: (text: string) => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    enable: () => void
    disable: () => void
  }
  backButton: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  expand: () => void
  close: () => void
  showQRScanner: (params?: { text?: string }) => Promise<string | null>
}

const TelegramContext = createContext<TelegramContextValue | null>(null)

function parseDeepLink(startParam: string | null): DeepLinkParams {
  if (!startParam) return {}

  const parts = startParam.split('_')
  const action = parts[0] as DeepLinkParams['action']
  const groupId = parts[1]
  const expenseId = parts[2]

  const validActions = ['view', 'settle', 'expense', 'analytics', 'recurring']
  return {
    action: action && validActions.includes(action) ? action : 'view',
    groupId,
    expenseId,
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  const isTelegram = typeof window !== 'undefined' && !!WebApp.initData

  // Extract user from init data - no fallback, must be authenticated via Telegram
  const user = useMemo<TelegramUser | null>(() => {
    if (!isTelegram) {
      return null
    }

    const u = WebApp.initDataUnsafe?.user
    if (!u) return null

    return {
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      language_code: u.language_code,
      photo_url: u.photo_url,
    }
  }, [isTelegram])

  // Extract theme
  const theme = useMemo<TelegramTheme>(() => {
    if (!isTelegram) return defaultTheme

    const tp = WebApp.themeParams
    return {
      colorScheme: WebApp.colorScheme || 'light',
      backgroundColor: tp.bg_color || defaultTheme.backgroundColor,
      textColor: tp.text_color || defaultTheme.textColor,
      hintColor: tp.hint_color || defaultTheme.hintColor,
      linkColor: tp.link_color || defaultTheme.linkColor,
      buttonColor: tp.button_color || defaultTheme.buttonColor,
      buttonTextColor: tp.button_text_color || defaultTheme.buttonTextColor,
      secondaryBackgroundColor: tp.secondary_bg_color || defaultTheme.secondaryBackgroundColor,
    }
  }, [isTelegram])

  // Start param and deep link
  const startParam = WebApp.initDataUnsafe?.start_param || null
  const deepLink = useMemo(() => parseDeepLink(startParam), [startParam])

  // Initialize
  useEffect(() => {
    if (isTelegram) {
      WebApp.ready()
      WebApp.expand()
    }
    setIsReady(true)
  }, [isTelegram])

  // Note: Theme is now managed by ThemeProvider in theme.tsx
  // Apply Telegram background color for seamless integration
  useEffect(() => {
    if (isTelegram) {
      document.body.style.backgroundColor = theme.backgroundColor
    }
  }, [theme, isTelegram])

  // Haptic feedback handlers
  const hapticFeedback = useMemo(() => ({
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      if (isTelegram) {
        WebApp.HapticFeedback.impactOccurred(style)
      }
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      if (isTelegram) {
        WebApp.HapticFeedback.notificationOccurred(type)
      }
    },
    selectionChanged: () => {
      if (isTelegram) {
        WebApp.HapticFeedback.selectionChanged()
      }
    },
  }), [isTelegram])

  // Main button handlers
  const mainButton = useMemo(() => ({
    show: () => WebApp.MainButton.show(),
    hide: () => WebApp.MainButton.hide(),
    setText: (text: string) => { WebApp.MainButton.text = text },
    onClick: (callback: () => void) => WebApp.MainButton.onClick(callback),
    offClick: (callback: () => void) => WebApp.MainButton.offClick(callback),
    showProgress: (leaveActive?: boolean) => WebApp.MainButton.showProgress(leaveActive),
    hideProgress: () => WebApp.MainButton.hideProgress(),
    enable: () => WebApp.MainButton.enable(),
    disable: () => WebApp.MainButton.disable(),
  }), [])

  // Back button handlers
  const backButton = useMemo(() => ({
    show: () => WebApp.BackButton.show(),
    hide: () => WebApp.BackButton.hide(),
    onClick: (callback: () => void) => WebApp.BackButton.onClick(callback),
    offClick: (callback: () => void) => WebApp.BackButton.offClick(callback),
  }), [])

  const expand = useCallback(() => WebApp.expand(), [])
  const close = useCallback(() => WebApp.close(), [])

  // QR Scanner
  const showQRScanner = useCallback((params?: { text?: string }): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!isTelegram) {
        resolve(null)
        return
      }
      WebApp.showScanQrPopup(params || {}, (data) => {
        WebApp.closeScanQrPopup()
        resolve(data || null)
      })
    })
  }, [isTelegram])

  const value = useMemo<TelegramContextValue>(() => ({
    user,
    theme,
    initData: WebApp.initData || '',
    initDataUnsafe: WebApp.initDataUnsafe as unknown as Record<string, unknown> || {},
    isReady,
    isTelegram,
    startParam,
    deepLink,
    hapticFeedback,
    mainButton,
    backButton,
    expand,
    close,
    showQRScanner,
  }), [
    user, theme, isReady, isTelegram, startParam, deepLink,
    hapticFeedback, mainButton, backButton, expand, close, showQRScanner
  ])

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  )
}

export function useTelegram() {
  const context = useContext(TelegramContext)
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider')
  }
  return context
}
