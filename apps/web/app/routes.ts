import { index, layout, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

export default [
  // Main app routes - wrapped with authenticated layout
  layout('routes/layout.tsx', [
    index('routes/home.tsx'),
    route('expenses', 'routes/expenses.tsx'),
    route('settle', 'routes/settle.tsx'),
    route('analytics', 'routes/analytics.tsx'),
    route('scan', 'routes/scan.tsx'),
    route('recurring', 'routes/recurring.tsx'),
  ]),
  // Public routes - no auth required
  route('session', 'routes/session.tsx'),
  route('ok', 'routes/healthcheck.tsx'),
  route('.well-known/appspecific/com.chrome.devtools.json', 'routes/devtools.tsx'),
] satisfies RouteConfig;
