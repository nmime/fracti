import Receipt from 'lucide-react/dist/esm/icons/receipt';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Users from 'lucide-react/dist/esm/icons/users';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { api, type AuthUser, type TelegramWidgetData } from '../services/api';
import { logger } from '../utils/logger';
import { useTelegram } from './TelegramProvider';

/**
 * Sync language from server on auth
 */
async function syncLanguageFromServer() {
  try {
    const { languageCode } = await api.getUserLanguage();
    if (languageCode && languageCode !== i18n.language) {
      await i18n.changeLanguage(languageCode);
      localStorage.setItem('fracti_language', languageCode);
      logger.info('Language synced from server', { languageCode });
    }
  } catch {
    // Ignore - use local language
  }
}

/**
 * Authentication Provider with JWT-based auth
 * Auth flow:
 * 1. Check for stored JWT token
 * 2. If token exists, verify it with /auth/me
 * 3. If in Telegram Mini App, authenticate with initData to get JWT
 * 4. Widget auth also issues JWT token
 */

interface AuthContextValue {
  user: AuthUser | null;
  wallet: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authMethod: 'init_data' | 'widget' | 'jwt' | null;
  refreshAuth: () => Promise<void>;
  logout: () => void;
  loginWithWidget: (widgetData: TelegramWidgetData) => Promise<boolean>;
  setWallet: (wallet: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const telegram = useTelegram();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'init_data' | 'widget' | 'jwt' | null>(null);

  useEffect(() => {
    if (!telegram.isReady) return;

    const authenticate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Check for existing JWT token first
        if (api.hasAuth()) {
          try {
            const response = await api.verifyAuth();
            setUser(response.user);
            setWallet(response.wallet);
            setIsAuthenticated(true);
            setAuthMethod(response.authMethod);
            logger.info('Auth restored from JWT token', {
              userId: response.user.id,
              authMethod: response.authMethod,
              hasWallet: !!response.wallet,
            });

            // Sync language from server
            void syncLanguageFromServer();

            return;
          } catch (err) {
            logger.warn('Stored JWT token invalid, clearing', { error: err });
            api.clearToken();
          }
        }

        // 2. If in Telegram Mini App, authenticate with initData to get new JWT
        if (telegram.initData && telegram.isTelegram) {
          const loginResponse = await api.loginWithInitData(telegram.initData);
          setUser(loginResponse.user);
          setIsAuthenticated(true);
          setAuthMethod(loginResponse.authMethod);

          // Fetch wallet info (loginWithInitData doesn't return wallet, need verifyAuth)
          try {
            const meResponse = await api.verifyAuth();
            setWallet(meResponse.wallet);
          } catch {
            // Ignore - wallet fetch is optional
          }

          logger.info('Auth successful via Mini App initData', {
            userId: loginResponse.user.id,
          });

          // Sync language from server
          void syncLanguageFromServer();

          return;
        }

        // 3. No auth available
        setIsAuthenticated(false);
        setUser(null);
        setAuthMethod(null);
      } catch (err) {
        logger.warn('Authentication failed', { error: err });
        setError(null); // Don't show error on initial load
        setIsAuthenticated(false);
        setUser(null);
        setAuthMethod(null);
        api.clearToken();
      } finally {
        setIsLoading(false);
      }
    };

    void authenticate();
  }, [telegram.isReady, telegram.initData, telegram.isTelegram]);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.verifyAuth();
      setUser(response.user);
      setWallet(response.wallet);
      setIsAuthenticated(true);
      setAuthMethod(response.authMethod);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setIsAuthenticated(false);
      setUser(null);
      setWallet(null);
      setAuthMethod(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    setWallet(null);
    setIsAuthenticated(false);
    setAuthMethod(null);
    setError(null);
    logger.info('User logged out');
  }, []);

  const loginWithWidget = useCallback(async (widgetData: TelegramWidgetData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.loginWithWidget(widgetData);
      setUser(response.user);
      setIsAuthenticated(true);
      setAuthMethod(response.authMethod);
      logger.info('Widget auth successful, JWT token stored', { userId: response.user.id });

      // Sync language from server
      void syncLanguageFromServer();

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Widget authentication failed';
      setError(message);
      logger.error('Widget auth failed', { error: err });

      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      wallet,
      isAuthenticated,
      isLoading,
      error,
      authMethod,
      refreshAuth,
      logout,
      loginWithWidget,
      setWallet,
    }),
    [user, wallet, isAuthenticated, isLoading, error, authMethod, refreshAuth, logout, loginWithWidget],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// Telegram Widget Login component
function TelegramWidgetLogin({ onAuth }: { onAuth: (data: TelegramWidgetData) => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    (window as unknown as Record<string, unknown>).TelegramLoginWidgetDataOnauth = (user: TelegramWidgetData) => {
      onAuth(user);
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'FractiBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'TelegramLoginWidgetDataOnauth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    containerRef.current?.appendChild(script);

    return () => {
      delete (window as unknown as Record<string, unknown>).TelegramLoginWidgetDataOnauth;
    };
  }, [onAuth]);

  return <div ref={containerRef} className="flex justify-center" />;
}

export function RequireAuth({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, error, loginWithWidget } = useAuth();

  if (isLoading) {
    return (
      <div className="from-background to-muted/30 flex min-h-screen items-center justify-center bg-gradient-to-b">
        <div className="text-center">
          <div className="bg-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <span className="text-primary-foreground text-2xl font-bold">F</span>
          </div>
          <div className="border-primary mx-auto mb-3 h-6 w-6 rounded-full border-2 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
          <p className="text-muted-foreground">{t('auth.authenticating')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;

    const handleWidgetAuth = async (widgetData: TelegramWidgetData) => {
      await loginWithWidget(widgetData);
    };

    return (
      <div className="from-background to-muted/30 flex min-h-screen flex-col bg-gradient-to-b">
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="bg-primary mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg">
            <span className="text-primary-foreground text-3xl font-bold">F</span>
          </div>

          <h1 className="mb-2 text-3xl font-bold">{t('auth.welcome')}</h1>
          <p className="text-muted-foreground mb-8 max-w-sm text-center">{t('auth.subtitle')}</p>

          <div className="mb-8 grid w-full max-w-sm grid-cols-2 gap-4">
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.track')}</span>
            </div>
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.split')}</span>
            </div>
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.settle')}</span>
            </div>
            <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900">
                <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm font-medium">{t('auth.feature.ai')}</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 w-full max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
              <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="w-full max-w-sm">
            <TelegramWidgetLogin onAuth={handleWidgetAuth} />
          </div>

          <div className="my-6 flex w-full max-w-sm items-center gap-4">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">{t('auth.or')}</span>
            <div className="bg-border h-px flex-1" />
          </div>

          <a
            href="https://t.me/FractiBot/app"
            className="bg-card hover:bg-muted/50 inline-flex items-center gap-2 rounded-lg border px-6 py-3 motion-safe:transition-colors motion-reduce:transition-none"
          >
            <svg className="h-5 w-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            <span className="font-medium">{t('auth.openInTelegram')}</span>
          </a>
        </div>

        <div className="p-6 text-center">
          <p className="text-muted-foreground text-xs">{t('auth.footer')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
