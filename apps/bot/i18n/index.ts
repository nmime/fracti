import type { Context } from 'grammy'
import en from './locales/en.json'
import ru from './locales/ru.json'

export type TranslationKey = keyof typeof en
export type Locale = 'en' | 'ru'
export type Translations = Record<string, string>

const translations: Record<Locale, Translations> = { en, ru }

export function getLocale(languageCode?: string): Locale {
  if (languageCode?.startsWith('ru')) return 'ru'
  return 'en'
}

export function createTranslator(locale: Locale) {
  const strings = translations[locale] || translations.en
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text: string = strings[key as string] || (en as Translations)[key as string] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}

export function getTranslator(ctx: Context) {
  const locale = getLocale(ctx.from?.language_code)
  return createTranslator(locale)
}

export type Translator = ReturnType<typeof createTranslator>
