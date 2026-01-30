import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { TelegramUser, TelegramTheme, DeepLinkParams } from '@libs/types';

/**
 * Telegram Mini App SDK Provider
 * Note: @twa-dev/sdk is loaded dynamically to avoid SSR issues
 */

const defaultTheme: TelegramTheme = {
  colorScheme: 'light',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  hintColor: '#999999',
  linkColor: '#0088CC',
  buttonColor: '#0088CC',
  buttonTextColor: '#ffffff',
  secondaryBackgroundColor: '#f4f4f5',
};

interface TelegramContextValue {
  user: TelegramUser | null;
  theme: TelegramTheme;
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  isReady: boolean;
  isTelegram: boolean;
  isTelegramEnv: boolean;
  startParam: string | null;
  deepLink: DeepLinkParams;
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  mainButton: {
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    enable: () => void;
    disable: () => void;
  };
  backButton: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  expand: () => void;
  close: () => void;
  showQRScanner: (params?: { text?: string }) => Promise<string | null>;
}

const TelegramContext = createContext<TelegramContextValue | null>(null);

function parseDeepLink(startParam: string | null): DeepLinkParams {
  if (!startParam) return {};

  const parts = startParam.split('_');
  const action = parts[0] as DeepLinkParams['action'];
  const groupId = parts[1];
  const expenseId = parts[2];

  const validActions = ['view', 'settle', 'expense', 'analytics', 'recurring'];

  return {
    action: action && validActions.includes(action) ? action : 'view',
    groupId,
    expenseId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebAppType = any;

// Detect dark mode from background color luminance
function detectDarkMode(webApp: WebAppType): 'light' | 'dark' {
  if (!webApp) return 'light';

  // First check colorScheme property
  if (webApp.colorScheme === 'dark') return 'dark';
  if (webApp.colorScheme === 'light') return 'light';

  // Fallback: check bg_color luminance
  const bgColor = webApp.themeParams?.bg_color || webApp.backgroundColor;
  if (bgColor && typeof bgColor === 'string') {
    const hex = bgColor.replace('#', '');
    if (hex.length >= 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5 ? 'dark' : 'light';
    }
  }

  return 'light';
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [webApp, setWebApp] = useState<WebAppType | null>(null);
  const webAppRef = useRef<WebAppType | null>(null);

  // Load WebApp SDK only on client
  useEffect(() => {
    if (typeof window === 'undefined') return;

    import('@twa-dev/sdk')
      .then((module) => {
        const WebApp = module.default;
        webAppRef.current = WebApp;
        setWebApp(WebApp);
        setIsReady(true);
      })
      .catch((err) => {
        console.error('Failed to load Telegram SDK:', err);
        // Still set ready so auth can proceed (will show login widget)
        setIsReady(true);
      });
  }, []);

  // Check if we're actually running inside Telegram's webview (for theme detection)
  // Note: window.Telegram.WebApp exists even in regular browsers because the SDK script is always loaded
  // We need to check for actual Telegram context (initData or TelegramWebviewProxy)
  const isTelegramEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    // TelegramWebviewProxy is only present inside Telegram's actual webview
    // initData is only populated when launched from Telegram
    return !!(
      'TelegramWebviewProxy' in window ||
      (window.Telegram?.WebApp?.initData && window.Telegram.WebApp.initData.length > 0)
    );
  }, []);

  // isTelegram requires initData for auth
  const isTelegram = !!webApp?.initData;

  // Detect color scheme
  const colorScheme = useMemo(() => {
    if (!webApp) return 'light' as const;
    return detectDarkMode(webApp);
  }, [webApp]);

  const user = useMemo<TelegramUser | null>(() => {
    if (!isTelegram || !webApp) return null;

    const u = webApp.initDataUnsafe?.user;
    if (!u) return null;

    return {
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      language_code: u.language_code,
      photo_url: u.photo_url,
    };
  }, [isTelegram, webApp]);

  const theme = useMemo<TelegramTheme>(() => {
    if (!webApp) {
      return { ...defaultTheme, colorScheme };
    }

    const tp = webApp.themeParams || {};

    return {
      colorScheme,
      backgroundColor: tp.bg_color || defaultTheme.backgroundColor,
      textColor: tp.text_color || defaultTheme.textColor,
      hintColor: tp.hint_color || defaultTheme.hintColor,
      linkColor: tp.link_color || defaultTheme.linkColor,
      buttonColor: tp.button_color || defaultTheme.buttonColor,
      buttonTextColor: tp.button_text_color || defaultTheme.buttonTextColor,
      secondaryBackgroundColor: tp.secondary_bg_color || defaultTheme.secondaryBackgroundColor,
    };
  }, [webApp, colorScheme]);

  const startParam = webApp?.initDataUnsafe?.start_param || null;
  const deepLink = useMemo(() => parseDeepLink(startParam), [startParam]);

  // Call ready() and expand() when in Telegram
  useEffect(() => {
    if (webApp && isTelegram) {
      webApp.ready();
      webApp.expand();
    }
  }, [isTelegram, webApp]);

  // Listen for theme changes
  useEffect(() => {
    if (!webApp?.onEvent) return;

    const handleThemeChange = () => {
      // Force re-render by updating webApp reference
      setWebApp({ ...webApp });
    };

    webApp.onEvent('themeChanged', handleThemeChange);

    return () => {
      webApp.offEvent?.('themeChanged', handleThemeChange);
    };
  }, [webApp]);

  const hapticFeedback = useMemo(
    () => ({
      impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
        if (isTelegram && webAppRef.current) webAppRef.current.HapticFeedback.impactOccurred(style);
      },
      notificationOccurred: (type: 'error' | 'success' | 'warning') => {
        if (isTelegram && webAppRef.current) webAppRef.current.HapticFeedback.notificationOccurred(type);
      },
      selectionChanged: () => {
        if (isTelegram && webAppRef.current) webAppRef.current.HapticFeedback.selectionChanged();
      },
    }),
    [isTelegram],
  );

  const mainButton = useMemo(
    () => ({
      show: () => webAppRef.current?.MainButton.show(),
      hide: () => webAppRef.current?.MainButton.hide(),
      setText: (text: string) => {
        if (webAppRef.current) webAppRef.current.MainButton.text = text;
      },
      onClick: (callback: () => void) => webAppRef.current?.MainButton.onClick(callback),
      offClick: (callback: () => void) => webAppRef.current?.MainButton.offClick(callback),
      showProgress: (leaveActive?: boolean) => webAppRef.current?.MainButton.showProgress(leaveActive),
      hideProgress: () => webAppRef.current?.MainButton.hideProgress(),
      enable: () => webAppRef.current?.MainButton.enable(),
      disable: () => webAppRef.current?.MainButton.disable(),
    }),
    [],
  );

  const backButton = useMemo(
    () => ({
      show: () => webAppRef.current?.BackButton.show(),
      hide: () => webAppRef.current?.BackButton.hide(),
      onClick: (callback: () => void) => webAppRef.current?.BackButton.onClick(callback),
      offClick: (callback: () => void) => webAppRef.current?.BackButton.offClick(callback),
    }),
    [],
  );

  const expand = useCallback(() => webAppRef.current?.expand(), []);
  const close = useCallback(() => webAppRef.current?.close(), []);

  const showQRScanner = useCallback(
    (params?: { text?: string }): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!isTelegram || !webAppRef.current) {
          resolve(null);
          return;
        }

        webAppRef.current.showScanQrPopup(params || {}, (data: string | null) => {
          webAppRef.current?.closeScanQrPopup();
          resolve(data || null);
        });
      });
    },
    [isTelegram],
  );

  const value = useMemo<TelegramContextValue>(
    () => ({
      user,
      theme,
      initData: webApp?.initData || '',
      initDataUnsafe: (webApp?.initDataUnsafe as unknown as Record<string, unknown>) || {},
      isReady,
      isTelegram,
      isTelegramEnv,
      startParam,
      deepLink,
      hapticFeedback,
      mainButton,
      backButton,
      expand,
      close,
      showQRScanner,
    }),
    [
      user,
      theme,
      webApp,
      isReady,
      isTelegram,
      isTelegramEnv,
      startParam,
      deepLink,
      hapticFeedback,
      mainButton,
      backButton,
      expand,
      close,
      showQRScanner,
    ],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within a TelegramProvider');
  }

  return context;
}
