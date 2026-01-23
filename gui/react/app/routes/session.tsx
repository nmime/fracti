import { useTelegram } from '@/lib/telegram'

export function meta() {
  return [
    { title: 'Session - Fracti' },
    { name: 'description', content: 'Session information' },
  ]
}

export default function SessionRoute() {
  const { user, initData, isTelegram, isReady, startParam, deepLink } = useTelegram()

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 space-y-6">
      <h1 className="text-2xl font-bold">Session Info</h1>

      {/* User Info */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">User</h2>
        {user ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span>{user.first_name} {user.last_name}</span>
            </div>
            {user.username && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username</span>
                <span>@{user.username}</span>
              </div>
            )}
            {user.language_code && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language</span>
                <span>{user.language_code.toUpperCase()}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No user data available</p>
        )}
      </div>

      {/* Init Data */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Init Data</h2>
        {initData ? (
          <div className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">
              {initData}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No init data available</p>
        )}
      </div>

      {/* Deep Link */}
      {startParam && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold mb-3">Deep Link</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Param</span>
              <span className="font-mono">{startParam}</span>
            </div>
            {deepLink.action && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action</span>
                <span>{deepLink.action}</span>
              </div>
            )}
            {deepLink.groupId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Group ID</span>
                <span className="font-mono">{deepLink.groupId}</span>
              </div>
            )}
            {deepLink.expenseId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expense ID</span>
                <span className="font-mono">{deepLink.expenseId}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platform Info */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">Platform</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform</span>
            <span>{isTelegram ? 'Telegram' : 'Web Browser'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ready</span>
            <span>{isReady ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
