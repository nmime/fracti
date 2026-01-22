import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import WebApp from '@twa-dev/sdk'

import en from './locales/en.json'
import ru from './locales/ru.json'

// Get language from Telegram WebApp if available
const getTelegramLanguage = (): string | undefined => {
  try {
    const user = WebApp.initDataUnsafe?.user
    if (user?.language_code) {
      const lang = user.language_code
      // Map language codes to our supported locales
      if (lang.startsWith('ru')) return 'ru'
      return 'en' // Default to English
    }
  } catch {
    // Ignore errors - WebApp may not be available outside Telegram
  }
  return undefined
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: getTelegramLanguage(), // Try Telegram language first
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'fracti-lang',
      caches: ['localStorage'],
    },
  })

export default i18n
export { i18n }

// Helper to get current language
export const getCurrentLanguage = () => i18n.language || 'en'

// Helper to change language
export const changeLanguage = (lang: 'en' | 'ru') => {
  i18n.changeLanguage(lang)
  try {
    localStorage.setItem('fracti-lang', lang)
  } catch {
    // localStorage may be unavailable in private browsing mode
  }
}
