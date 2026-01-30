import { getUserLanguage } from '@libs/db';
import en from './locales/en.json';
import ru from './locales/ru.json';
import type { Context } from 'grammy';

export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'ru';
export type Translations = Record<string, string>;

const translations: Record<Locale, Translations> = { en, ru };

export function getLocale(languageCode?: string): Locale {
  if (languageCode?.startsWith('ru')) return 'ru';

  return 'en';
}

export function createTranslator(locale: Locale) {
  const strings = translations[locale] || translations.en;

  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text: string = strings[key as string] || (en as Translations)[key as string] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }

    return text;
  };
}

/**
 * Get translator for a context - uses stored preference, falls back to Telegram language
 */
export function getTranslator(ctx: Context) {
  const locale = getLocale(ctx.from?.language_code);

  return createTranslator(locale);
}

/**
 * Get translator with stored language preference from database
 * Use this for responses where we want to respect user's saved preference
 */
export async function getTranslatorAsync(ctx: Context) {
  const telegramId = ctx.from?.id;

  if (telegramId) {
    try {
      const storedLanguage = await getUserLanguage(telegramId);
      if (storedLanguage) {
        return createTranslator(storedLanguage);
      }
    } catch {
      // Ignore DB errors, fall back to Telegram language
    }
  }

  return getTranslator(ctx);
}

export type Translator = ReturnType<typeof createTranslator>;
