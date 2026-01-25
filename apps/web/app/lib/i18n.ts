import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Inline translations for now - can be moved to separate files later
const resources = {
  en: {
    translation: {
      home: {
        allGroups: 'All Groups',
        debtWeb: 'Debt Web',
        expenses: 'Expenses',
        justNow: 'Just now',
        hoursAgo: '{{count}}h ago',
        hoursAgo_other: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
        daysAgo_other: '{{count}}d ago',
        members: 'Members',
        noActivity: 'No recent activity',
        noDebts: 'No debts yet',
        recentActivity: 'Recent Activity',
        settleUp: 'Settle Up',
        viewAll: 'View All',
        youAreOwed: 'You are owed',
        youOwe: 'You owe',
      },
      expenses: {
        title: 'Expenses',
        addExpense: 'Add Expense',
        noExpenses: 'No expenses yet',
      },
      settle: {
        title: 'Settle',
        settleDebts: 'Settle Debts',
      },
      analytics: {
        title: 'Analytics',
      },
      recurring: {
        title: 'Recurring',
      },
      scan: {
        title: 'Scan',
      },
      errors: {
        generic: 'Something went wrong',
        notFound: 'Page not found',
      },
    },
  },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
