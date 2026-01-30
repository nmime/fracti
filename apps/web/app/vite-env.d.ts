/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TONCONNECT_MANIFEST_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram WebApp global types
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  backgroundColor: string;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
  TelegramWebviewProxy?: unknown;
}
