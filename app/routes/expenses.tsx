import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useTelegram } from '@/lib/telegram'
import { api, type Expense, type User, type CreateExpenseInput } from '@/lib/api'
import { ExpenseCard } from '@/components/ExpenseCard'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

// Demo data
const demoMembers: User[] = [
  { id: '1', telegramId: 123, name: 'You', username: 'you' },
  { id: '2', telegramId: 456, name: 'Alice', username: 'alice' },
  { id: '3', telegramId: 789, name: 'Bob', username: 'bob' },
  { id: '4', telegramId: 101, name: 'Charlie', username: 'charlie' },
]

const demoExpenses: Expense[] = [
  {
    id: '1',
    groupId: 'demo',
    payerId: '2',
    payerName: 'Alice',
    amount: 120,
    description: 'Dinner at Italian Restaurant',
    splitType: 'equal',
    splits: [
      { userId: '1', userName: 'You', amount: 30 },
      { userId: '2', userName: 'Alice', amount: 30 },
      { userId: '3', userName: 'Bob', amount: 30 },
      { userId: '4', userName: 'Charlie', amount: 30 },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    groupId: 'demo',
    payerId: '1',
    payerName: 'You',
    amount: 85,
    description: 'Groceries',
    splitType: 'equal',
    splits: [
      { userId: '1', userName: 'You', amount: 28.33 },
      { userId: '2', userName: 'Alice', amount: 28.33 },
      { userId: '3', userName: 'Bob', amount: 28.34 },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    groupId: 'demo',
    payerId: '3',
    payerName: 'Bob',
    amount: 35,
    description: 'Uber to airport',
    splitType: 'equal',
    splits: [
      { userId: '1', userName: 'You', amount: 17.5 },
      { userId: '3', userName: 'Bob', amount: 17.5 },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
]

export default function ExpensesPage() {
  const { user } = useTelegram()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>(demoExpenses)
  const [members] = useState<User[]>(demoMembers)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine' | 'owe'>('all')
  const [isLoading, setIsLoading] = useState(false)

  const currentUserId = '1' // In production, get from Telegram user

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = expense.description
      .toLowerCase()
      .includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    switch (filter) {
      case 'mine':
        return expense.payerId === currentUserId
      case 'owe':
        return (
          expense.payerId !== currentUserId &&
          expense.splits.some((s) => s.userId === currentUserId)
        )
      default:
        return true
    }
  })

  const handleAddExpense = async (data: CreateExpenseInput) => {
    try {
      // In production: const newExpense = await api.createExpense('demo', data)
      const newExpense: Expense = {
        id: Date.now().toString(),
        groupId: 'demo',
        payerId: data.payerId,
        payerName: members.find((m) => m.id === data.payerId)?.name ?? 'Unknown',
        amount: data.amount,
        description: data.description,
        splitType: data.splitType,
        splits: data.splits.map((s) => ({
          userId: s.userId,
          userName: members.find((m) => m.id === s.userId)?.name ?? 'Unknown',
          amount: s.amount ?? 0,
        })),
        createdAt: new Date().toISOString(),
      }
      setExpenses([newExpense, ...expenses])
      toast({
        title: 'Expense added',
        description: `${data.description} for ${data.amount} TON`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to add expense',
        description: 'Please try again',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      // In production: await api.deleteExpense('demo', id)
      setExpenses(expenses.filter((e) => e.id !== id))
      toast({
        title: 'Expense deleted',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to delete expense',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="sticky top-14 z-30 space-y-4 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Expenses</h1>
          <AddExpenseDialog
            members={members}
            currentUserId={currentUserId}
            onSubmit={handleAddExpense}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1">
              I Paid
            </TabsTrigger>
            <TabsTrigger value="owe" className="flex-1">
              I Owe
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Expense List */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4 pb-20">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p className="text-muted-foreground">No expenses found</p>
              <p className="text-sm text-muted-foreground">
                Add your first expense to get started
              </p>
            </div>
          ) : (
            filteredExpenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                currentUserId={currentUserId}
                onDelete={handleDeleteExpense}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
