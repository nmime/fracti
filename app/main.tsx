import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TelegramProvider } from '@/lib/telegram'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import RootLayout from '@/components/RootLayout'
import HomePage from '@/routes/home'
import ExpensesPage from '@/routes/expenses'
import SettlePage from '@/routes/settle'
import ScanPage from '@/routes/scan'
import { tonConfig } from '@/lib/config'
import '@/lib/i18n' // Initialize i18n
import '@/styles/globals.css'

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
              <Routes>
                <Route element={<RootLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="settle" element={<SettlePage />} />
                  <Route path="scan" element={<ScanPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster />
          </TelegramProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
