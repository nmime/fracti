import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from './+types/root';
import { ClientOnly } from '@/components/ClientOnly';
// TonConnect is loaded only on client via .client.tsx file
import { TonConnectProvider } from '@/components/TonConnectProvider.client';
import { TonAuthProvider } from '@/components/TonAuthProvider.client';
import { TelegramProvider, ThemeProvider, AuthProvider, GroupProvider } from '@/providers';
import './styles/tailwind.css';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export const links: Route.LinksFunction = () => [
  // Favicon
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },

  // Google Fonts
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },

  // Currency APIs - for price data and exchange rates
  { rel: 'preconnect', href: 'https://api.coingecko.com', crossOrigin: 'anonymous' },
  { rel: 'preconnect', href: 'https://api.exchangerate.host', crossOrigin: 'anonymous' },

  // TON APIs - for blockchain data and TON Connect
  { rel: 'preconnect', href: 'https://bridge.tonapi.io', crossOrigin: 'anonymous' },
  { rel: 'dns-prefetch', href: 'https://tonapi.io' },
  { rel: 'dns-prefetch', href: 'https://toncenter.com' },

  // Telegram CDN - for user avatars and media
  { rel: 'preconnect', href: 'https://api.telegram.org', crossOrigin: 'anonymous' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0088CC" />
        <Meta />
        <Links />
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-background text-foreground h-full overflow-hidden">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  // TonConnectProvider is undefined on server (loaded from .client.tsx)
  const content = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

  return (
    <TelegramProvider>
      <ThemeProvider>
        <AuthProvider>
          <GroupProvider>
            <ClientOnly fallback={content}>
              {TonConnectProvider ? (
                <TonConnectProvider>
                  <TonAuthProvider>{content}</TonAuthProvider>
                </TonConnectProvider>
              ) : (
                content
              )}
            </ClientOnly>
          </GroupProvider>
        </AuthProvider>
      </ThemeProvider>
    </TelegramProvider>
  );
}

function ErrorFallback({ error }: { error: unknown }) {
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mb-4">{errorMessage}</p>
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      <AppProviders>
        <Outlet />
      </AppProviders>
    </ReactErrorBoundary>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold">{message}</h1>
        <p className="text-muted-foreground mb-4">{details}</p>
        {stack && <pre className="bg-muted overflow-auto rounded-md p-4 text-left text-xs">{stack}</pre>}
      </div>
    </main>
  );
}
