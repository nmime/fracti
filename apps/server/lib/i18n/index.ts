import en from './locales/en.json';
import ru from './locales/ru.json';

export type Locale = 'en' | 'ru';

type TranslationKeys = typeof en;
type NestedKeyOf<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? `${K}.${NestedKeyOf<T[K]>}`
    : K
  : never;

export type TranslationKey = NestedKeyOf<TranslationKeys>;

const locales: Record<Locale, TranslationKeys> = {
  en,
  ru,
};

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return key if not found
    }
  }

  return typeof current === 'string' ? current : path;
}

// Interpolate variables in string
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;

  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

// Create translator function for a specific locale
export function createTranslator(locale: Locale = 'en') {
  const translations = locales[locale] || locales.en;

  return function t(key: string, params?: Record<string, string | number>): string {
    const value = getNestedValue(translations as unknown as Record<string, unknown>, key);

    return interpolate(value, params);
  };
}

// Get locale from Telegram user's language code
export function getLocaleFromLanguageCode(languageCode?: string): Locale {
  if (!languageCode) return 'en';

  // Handle language codes like 'ru', 'ru-RU', etc.
  const lang = languageCode.split('-')[0].toLowerCase();

  if (lang === 'ru') return 'ru';

  return 'en'; // Default to English
}

// Export locales for direct access if needed
export { en, ru };
