import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import {
  SDKProvider,
  useInitData,
  useLaunchParams,
  useMiniApp,
  useThemeParams,
  useViewport,
  useBackButton,
  useMainButton,
  useHapticFeedback,
} from '@tma.js/sdk-react'
import type { TelegramUser, TelegramTheme, DeepLinkParams } from '@core/types'

// Demo user for development outside Telegram
const demoUser: TelegramUser = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
  language_code: 'en',
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

function TelegramProviderInner({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const initData = useInitData()
  const launchParams = useLaunchParams()
  const miniApp = useMiniApp()
  const themeParams = useThemeParams()
  const viewport = useViewport()
  const backButton = useBackButton()
  const mainButton = useMainButton()
  const hapticFeedback = useHapticFeedback()

  const isTelegram = typeof window !== 'undefined' && !!initData

  // Extract user from init data
  const user = useMemo<TelegramUser | null>(() => {
    if (!initData?.user) return isTelegram ? null : demoUser

    const u = initData.user
    return {
      id: u.id,
      first_name: u.firstName,
      last_name: u.lastName,
      username: u.username,
      language_code: u.languageCode,
      photo_url: u.photoUrl,
    }
  }, [initData?.user, isTelegram])

  // Extract theme
  const theme = useMemo<TelegramTheme>(() => {
    if (!themeParams) return defaultTheme

    return {
      colorScheme: miniApp?.isDark ? 'dark' : 'light',
      backgroundColor: themeParams.bgColor || defaultTheme.backgroundColor,
      textColor: themeParams.textColor || defaultTheme.textColor,
      hintColor: themeParams.hintColor || defaultTheme.hintColor,
      linkColor: themeParams.linkColor || defaultTheme.linkColor,
      buttonColor: themeParams.buttonColor || defaultTheme.buttonColor,
      buttonTextColor: themeParams.buttonTextColor || defaultTheme.buttonTextColor,
      secondaryBackgroundColor: themeParams.secondaryBgColor || defaultTheme.secondaryBackgroundColor,
    }
  }, [themeParams, miniApp?.isDark])

  // Start param and deep link
  const startParam = launchParams?.initDataRaw
    ? new URLSearchParams(launchParams.initDataRaw).get('start_param')
    : null
  const deepLink = useMemo(() => parseDeepLink(startParam), [startParam])

  // Initialize
  useEffect(() => {
    if (isTelegram && miniApp) {
      miniApp.ready()
      viewport?.expand()
    }
    setIsReady(true)
  }, [isTelegram, miniApp, viewport])

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme.colorScheme === 'dark')
    document.body.style.backgroundColor = theme.backgroundColor
  }, [theme])

  // Haptic feedback handlers
  const hapticHandlers = useMemo(() => ({
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      hapticFeedback?.impactOccurred(style)
    },
    notificationOccurred: (type: 'error' | 'success' | 'warning') => {
      hapticFeedback?.notificationOccurred(type)
    },
    selectionChanged: () => {
      hapticFeedback?.selectionChanged()
    },
  }), [hapticFeedback])

  // Main button handlers
  const mainButtonHandlers = useMemo(() => ({
    show: () => mainButton?.show(),
    hide: () => mainButton?.hide(),
    setText: (text: string) => mainButton?.setText(text),
    onClick: (callback: () => void) => mainButton?.on('click', callback),
    offClick: (callback: () => void) => mainButton?.off('click', callback),
    showProgress: (leaveActive?: boolean) => mainButton?.showProgress(leaveActive),
    hideProgress: () => mainButton?.hideProgress(),
    enable: () => mainButton?.enable(),
    disable: () => mainButton?.disable(),
  }), [mainButton])

  // Back button handlers
  const backButtonHandlers = useMemo(() => ({
    show: () => backButton?.show(),
    hide: () => backButton?.hide(),
    onClick: (callback: () => void) => backButton?.on('click', callback),
    offClick: (callback: () => void) => backButton?.off('click', callback),
  }), [backButton])

  const expand = useCallback(() => viewport?.expand(), [viewport])
  const close = useCallback(() => miniApp?.close(), [miniApp])

  const value = useMemo<TelegramContextValue>(() => ({
    user,
    theme,
    initData: launchParams?.initDataRaw || '',
    initDataUnsafe: initData as unknown as Record<string, unknown> || {},
    isReady,
    isTelegram,
    startParam,
    deepLink,
    hapticFeedback: hapticHandlers,
    mainButton: mainButtonHandlers,
    backButton: backButtonHandlers,
    expand,
    close,
  }), [
    user, theme, launchParams?.initDataRaw, initData, isReady, isTelegram,
    startParam, deepLink, hapticHandlers, mainButtonHandlers, backButtonHandlers,
    expand, close
  ])

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  )
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  return (
    <SDKProvider acceptCustomStyles>
      <TelegramProviderInner>{children}</TelegramProviderInner>
    </SDKProvider>
  )
}

export function useTelegram() {
  const context = useContext(TelegramContext)
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider')
  }
  return context
}
