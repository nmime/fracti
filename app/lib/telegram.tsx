import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import WebApp from '@twa-dev/sdk'
import { demoUser } from '@/lib/fixtures'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface TelegramTheme {
  colorScheme: 'light' | 'dark'
  backgroundColor: string
  textColor: string
  hintColor: string
  linkColor: string
  buttonColor: string
  buttonTextColor: string
  secondaryBackgroundColor: string
}

interface TelegramContextValue {
  user: TelegramUser | null
  theme: TelegramTheme
  initData: string
  initDataUnsafe: Record<string, unknown>
  isReady: boolean
  isTelegram: boolean
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
}

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

const TelegramContext = createContext<TelegramContextValue | null>(null)

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [theme, setTheme] = useState<TelegramTheme>(defaultTheme)

  const isTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp

  useEffect(() => {
    if (!isTelegram) {
      setIsReady(true)
      // Use demo user for development (when not running in Telegram)
      setUser(demoUser)
      return
    }

    try {
      WebApp.ready()
      WebApp.expand()

      const tgUser = WebApp.initDataUnsafe.user
      if (tgUser) {
        setUser({
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          language_code: tgUser.language_code,
          photo_url: tgUser.photo_url,
        })
      }

      const themeParams = WebApp.themeParams
      setTheme({
        colorScheme: WebApp.colorScheme,
        backgroundColor: themeParams.bg_color || defaultTheme.backgroundColor,
        textColor: themeParams.text_color || defaultTheme.textColor,
        hintColor: themeParams.hint_color || defaultTheme.hintColor,
        linkColor: themeParams.link_color || defaultTheme.linkColor,
        buttonColor: themeParams.button_color || defaultTheme.buttonColor,
        buttonTextColor: themeParams.button_text_color || defaultTheme.buttonTextColor,
        secondaryBackgroundColor: themeParams.secondary_bg_color || defaultTheme.secondaryBackgroundColor,
      })

      // Apply theme to document
      document.documentElement.classList.toggle('dark', WebApp.colorScheme === 'dark')
      document.body.style.backgroundColor = themeParams.bg_color || defaultTheme.backgroundColor

      setIsReady(true)
    } catch (error) {
      console.error('Telegram WebApp initialization error:', error)
      setIsReady(true)
    }
  }, [isTelegram])

  // Memoize haptic feedback handlers
  const hapticFeedback = useMemo(() => ({
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      if (isTelegram) WebApp.HapticFeedback.impactOccurred(style)
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      if (isTelegram) WebApp.HapticFeedback.notificationOccurred(type)
    },
    selectionChanged: () => {
      if (isTelegram) WebApp.HapticFeedback.selectionChanged()
    },
  }), [isTelegram])

  // Memoize main button handlers
  const mainButton = useMemo(() => ({
    show: () => isTelegram && WebApp.MainButton.show(),
    hide: () => isTelegram && WebApp.MainButton.hide(),
    setText: (text: string) => isTelegram && WebApp.MainButton.setText(text),
    onClick: (callback: () => void) => isTelegram && WebApp.MainButton.onClick(callback),
    offClick: (callback: () => void) => isTelegram && WebApp.MainButton.offClick(callback),
    showProgress: (leaveActive?: boolean) => isTelegram && WebApp.MainButton.showProgress(leaveActive),
    hideProgress: () => isTelegram && WebApp.MainButton.hideProgress(),
    enable: () => isTelegram && WebApp.MainButton.enable(),
    disable: () => isTelegram && WebApp.MainButton.disable(),
  }), [isTelegram])

  // Memoize back button handlers
  const backButton = useMemo(() => ({
    show: () => isTelegram && WebApp.BackButton.show(),
    hide: () => isTelegram && WebApp.BackButton.hide(),
    onClick: (callback: () => void) => isTelegram && WebApp.BackButton.onClick(callback),
    offClick: (callback: () => void) => isTelegram && WebApp.BackButton.offClick(callback),
  }), [isTelegram])

  // Memoize expand and close
  const expand = useCallback(() => isTelegram && WebApp.expand(), [isTelegram])
  const close = useCallback(() => isTelegram && WebApp.close(), [isTelegram])

  // Memoize the entire context value
  const value = useMemo<TelegramContextValue>(() => ({
    user,
    theme,
    initData: isTelegram ? WebApp.initData : '',
    initDataUnsafe: isTelegram ? WebApp.initDataUnsafe : {},
    isReady,
    isTelegram,
    hapticFeedback,
    mainButton,
    backButton,
    expand,
    close,
  }), [user, theme, isReady, isTelegram, hapticFeedback, mainButton, backButton, expand, close])

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
