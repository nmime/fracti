import { useTelegram } from '@/providers';

export function meta() {
  return [{ title: 'Session - Fracti' }, { name: 'description', content: 'Session information' }];
}

export default function SessionRoute() {
  const { user, initData, isTelegram, isReady, startParam, deepLink } = useTelegram();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 rounded-full border-b-2 motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 min-h-screen space-y-6 p-4 motion-safe:duration-200">
      <h1 className="text-2xl font-bold">Session Info</h1>

      {/* User Info */}
      <div className="bg-card rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">User</h2>
        {user ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span>
                {user.first_name} {user.last_name}
              </span>
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
          <p className="text-muted-foreground text-sm">No user data available</p>
        )}
      </div>

      {/* Init Data */}
      <div className="bg-card rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Init Data</h2>
        {initData ? (
          <div className="bg-muted overflow-x-auto rounded p-3 font-mono text-xs">
            <pre className="break-all whitespace-pre-wrap">{initData}</pre>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No init data available</p>
        )}
      </div>

      {/* Deep Link */}
      {startParam && (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">Deep Link</h2>
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
      <div className="bg-card rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">Platform</h2>
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
  );
}
