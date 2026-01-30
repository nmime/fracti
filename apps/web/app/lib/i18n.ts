import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      // useSuspense: false is required for SSR/hydration with lazy loading
      // Allows components to render immediately while translations load asynchronously
      // Setting to true would cause hydration errors as translations aren't available server-side
      useSuspense: false,
    },
  });

// Expose i18n instance to window for testing/debugging in browser console
// This allows testing language switching via: window.i18n.changeLanguage('ru')
if (typeof window !== 'undefined') {
  (window as unknown as { i18n: typeof i18n }).i18n = i18n;
}

export default i18n;
