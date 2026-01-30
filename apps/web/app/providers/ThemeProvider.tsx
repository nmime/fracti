import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useTelegram } from './TelegramProvider';

/**
 * Theme Provider for dark/light mode management
 */

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'fracti-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const telegram = useTelegram();
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Load stored theme preference (only outside Telegram or if explicitly set)
  useEffect(() => {
    // In Telegram environment, always start with 'system' to follow Telegram's theme
    // Users can still toggle manually during the session
    if (telegram.isTelegramEnv) {
      // Clear any stale theme preference to ensure we follow Telegram
      // User can toggle if they want something different
      setThemeState('system');
      return;
    }

    // Outside Telegram, respect stored preference
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
  }, [telegram.isTelegramEnv]);

  useEffect(() => {
    let resolved: 'light' | 'dark';

    if (telegram.isTelegramEnv) {
      // In Telegram: Always use Telegram's detected color scheme
      // User can still toggle manually if they want, but default follows Telegram
      if (theme === 'system') {
        // System preference in Telegram = follow Telegram's theme
        resolved = telegram.theme.colorScheme;
      } else {
        // User explicitly chose light or dark - respect that
        resolved = theme;
      }
    } else {
      // Outside Telegram: use system preference or explicit choice
      if (theme === 'system') {
        resolved = getSystemTheme();
      } else {
        resolved = theme;
      }
    }

    setResolvedTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [theme, telegram.isTelegramEnv, telegram.theme.colorScheme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
