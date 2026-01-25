import { RequireAuth } from '@/providers'
import RootLayout from '@/components/RootLayout'

/**
 * Authenticated Layout Route
 *
 * This layout wraps all main app routes with:
 * 1. Authentication check (RequireAuth) - Shows login for browser users
 * 2. RootLayout - Header, navigation, and main content area
 *
 * Entry Flows:
 * - From Chat (deeplink): initData auto-auth → GROUP VIEW
 * - From TMA (direct): initData auto-auth → USER VIEW
 * - From Browser: Widget login required → USER VIEW
 */
export default function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <RootLayout />
    </RequireAuth>
  )
}
