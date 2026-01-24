import { useState } from 'react'

interface DocSection {
  id: string
  title: string
  icon: string
  content: React.ReactNode
}

const sections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    content: (
      <div className="space-y-3">
        <p>Welcome to Fracti! Here's how to get started:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Add the bot to your group chat</li>
          <li>Mention @FractiBot with expense details</li>
          <li>Or send a receipt photo to scan</li>
          <li>Open the Mini App to view balances</li>
          <li>Connect your TON wallet to settle up</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'adding-expenses',
    title: 'Adding Expenses',
    icon: '💸',
    content: (
      <div className="space-y-3">
        <p>There are several ways to add expenses:</p>
        <div className="space-y-2">
          <div className="p-2 bg-muted rounded">
            <p className="font-medium">Natural Language</p>
            <code className="text-sm">@FractiBot I paid 50 for dinner with Alice</code>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="font-medium">Receipt Scan</p>
            <p className="text-sm text-muted-foreground">
              Send a photo of your receipt and we'll extract the items automatically
            </p>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="font-medium">Mini App Form</p>
            <p className="text-sm text-muted-foreground">
              Use the + button in the Expenses tab
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'settling-debts',
    title: 'Settling Debts',
    icon: '✅',
    content: (
      <div className="space-y-3">
        <p>Settle your debts using TON:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Go to the Settle tab</li>
          <li>Connect your TON wallet</li>
          <li>Select a suggested settlement</li>
          <li>Confirm the transaction</li>
          <li>The settlement is recorded on-chain</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Fracti uses a min-cash-flow algorithm to minimize the number of
          transactions needed to settle all debts.
        </p>
      </div>
    ),
  },
  {
    id: 'debt-graph',
    title: 'Debt Web',
    icon: '🕸️',
    content: (
      <div className="space-y-3">
        <p>The Debt Web visualization shows:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <span className="text-green-600 font-medium">Green nodes</span> - People who are owed money
          </li>
          <li>
            <span className="text-red-600 font-medium">Red nodes</span> - People who owe money
          </li>
          <li>
            <span className="font-medium">Lines</span> - Debts between people
          </li>
          <li>
            <span className="font-medium">Line thickness</span> - Debt amount
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Tap on a node to see details about that person's balance.
        </p>
      </div>
    ),
  },
  {
    id: 'qr-scanner',
    title: 'QR Scanner',
    icon: '📷',
    content: (
      <div className="space-y-3">
        <p>Use the QR scanner to:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Join a group via invite QR</li>
          <li>Add expenses from QR codes</li>
          <li>Scan TON wallet addresses for payments</li>
          <li>Import receipt data</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          The QR scanner is only available when running inside Telegram.
        </p>
      </div>
    ),
  },
  {
    id: 'device-sensors',
    title: 'Device Features',
    icon: '📱',
    content: (
      <div className="space-y-3">
        <p>Fracti can access device sensors:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <span className="font-medium">Gyroscope</span> - 3D orientation tracking
          </li>
          <li>
            <span className="font-medium">Shake Detection</span> - Trigger actions by shaking
          </li>
          <li>
            <span className="font-medium">GPS</span> - Location-based features
          </li>
          <li>
            <span className="font-medium">Haptic Feedback</span> - Touch feedback
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Sensor access requires permission and works best in Telegram.
        </p>
      </div>
    ),
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: '📊',
    content: (
      <div className="space-y-3">
        <p>The Analytics tab shows:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Total group spending over time</li>
          <li>Spending by category breakdown</li>
          <li>Top spenders leaderboard</li>
          <li>Monthly and weekly trends</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Use analytics to understand your group's spending patterns.
        </p>
      </div>
    ),
  },
  {
    id: 'recurring',
    title: 'Recurring Expenses',
    icon: '🔄',
    content: (
      <div className="space-y-3">
        <p>Set up recurring expenses for regular bills:</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Go to the Recurring tab</li>
          <li>Create a new template</li>
          <li>Set the frequency (weekly, monthly, etc.)</li>
          <li>Expenses are created automatically</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Perfect for rent, utilities, subscriptions, and other regular expenses.
        </p>
      </div>
    ),
  },
]

export function Documentation() {
  const [activeSection, setActiveSection] = useState<string>('getting-started')

  const currentSection = sections.find((s) => s.id === activeSection)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Documentation</h2>
        <p className="text-sm text-muted-foreground">
          Learn how to use Fracti
        </p>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 space-y-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span className="text-xl">{section.icon}</span>
              <span className="font-medium">{section.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Panel */}
      {currentSection && (
        <div className="border-t bg-card">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{currentSection.icon}</span>
              <h3 className="text-lg font-semibold">{currentSection.title}</h3>
            </div>
            <div className="text-sm">{currentSection.content}</div>
          </div>
        </div>
      )}
    </div>
  )
}
