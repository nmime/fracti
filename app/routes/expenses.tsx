import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/lib/telegram'
import { type Expense, type User, type CreateExpenseInput } from '@/lib/api'
import { demoMembers, createDemoExpenses } from '@/lib/fixtures'
import { ExpenseCard } from '@/components/ExpenseCard'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function ExpensesPage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>(() => createDemoExpenses())
  const [members] = useState<User[]>(demoMembers)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine' | 'owe'>('all')
  const [isLoading] = useState(false) // TODO: Implement loading state when fetching from API

  // Use Telegram user ID when available, fallback to demo user '1' for development
  const currentUserId = user?.id ? String(user.id) : '1'

  // Memoize filtered expenses to avoid recalculation on every render
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
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
  }, [expenses, searchQuery, filter, currentUserId])

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
        splitType: data.splitType ?? 'equal',
        splits: data.splits.map((s) => ({
          userId: s.userId,
          userName: members.find((m) => m.id === s.userId)?.name ?? 'Unknown',
          amount: s.amount ?? 0,
        })),
        createdAt: new Date().toISOString(),
      }
      setExpenses([newExpense, ...expenses])
      toast({
        title: t('toast.expenseAdded.title'),
        description: t('toast.expenseAdded.description', {
          description: data.description,
          amount: data.amount
        }),
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: t('toast.expenseError.title'),
        description: t('toast.expenseError.description'),
        variant: 'destructive',
      })
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      // In production: await api.deleteExpense('demo', id)
      setExpenses(expenses.filter((e) => e.id !== id))
      toast({
        title: t('toast.expenseDeleted.title'),
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: t('toast.deleteError.title'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="sticky top-14 z-30 space-y-4 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('expenses.title')}</h1>
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
            placeholder={t('expenses.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">
              {t('expenses.tabs.all')}
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1">
              {t('expenses.tabs.iPaid')}
            </TabsTrigger>
            <TabsTrigger value="owe" className="flex-1">
              {t('expenses.tabs.iOwe')}
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
              <p className="text-muted-foreground">{t('expenses.empty.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('expenses.empty.description')}
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
