import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TelegramProvider } from '@/lib/telegram'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import { DeepLinkHandler } from '@/components/DeepLinkHandler'
import { RouteLoadingFallback } from '@/components/RouteLoadingFallback'
import RootLayout from '@/components/RootLayout'
import { tonConfig } from '@/lib/config'
import '@/lib/i18n' // Initialize i18n
import '@/styles/globals.css'

// Lazy load route components for better initial bundle size
const HomePage = lazy(() => import('@/routes/home'))
const ExpensesPage = lazy(() => import('@/routes/expenses'))
const SettlePage = lazy(() => import('@/routes/settle'))
const ScanPage = lazy(() => import('@/routes/scan'))
const AnalyticsPage = lazy(() => import('@/routes/analytics'))
const RecurringPage = lazy(() => import('@/routes/recurring'))

// Create a client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonConfig.manifestUrl}>
          <TelegramProvider>
            <BrowserRouter>
              <DeepLinkHandler />
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route element={<RootLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route path="settle" element={<SettlePage />} />
                    <Route path="scan" element={<ScanPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="recurring" element={<RecurringPage />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster />
          </TelegramProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
