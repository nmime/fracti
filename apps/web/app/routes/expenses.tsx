import { useState, useMemo, useEffect } from 'react'
import { Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/lib/telegram'
import { useGroup } from '@/lib/group-context'
import { type Expense, type User, type CreateExpenseInput, api } from '@/lib/api'
import { logger } from '@/lib/logger'
import { ExpenseCard } from '@/components/ExpenseCard'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function ExpensesPage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { groupId, isLoading: groupLoading } = useGroup()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine' | 'owe'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Use Telegram user ID when available
  const currentUserId = user?.id ? String(user.id) : ''

  // Fetch group data (including members) and expenses from API on mount
  useEffect(() => {
    if (!groupId || groupLoading) return

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      try {
        // Fetch group (with members) and expenses in parallel
        const [groupData, expensesData] = await Promise.all([
          api.getGroup(groupId),
          api.getExpenses(groupId),
        ])
        if (!abortController.signal.aborted) {
          setMembers(groupData.members)
          setExpenses(expensesData)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        logger.error('Failed to load group data', { groupId }, err)
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadData()

    return () => abortController.abort()
  }, [groupId, groupLoading])

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
    if (!groupId) return

    try {
      const newExpense = await api.createExpense(groupId, data)
      setExpenses([newExpense, ...expenses])
      toast({
        title: t('toast.expenseAdded.title'),
        description: t('toast.expenseAdded.description', {
          description: data.description,
          amount: data.amount
        }),
        variant: 'success',
      })
    } catch (err) {
      logger.error('Failed to add expense', { groupId }, err)
      toast({
        title: t('toast.expenseError.title'),
        description: t('toast.expenseError.description'),
        variant: 'destructive',
      })
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!groupId) return

    try {
      await api.deleteExpense(groupId, id)
      setExpenses(expenses.filter((e) => e.id !== id))
      toast({
        title: t('toast.expenseDeleted.title'),
        variant: 'success',
      })
    } catch (err) {
      logger.error('Failed to delete expense', { groupId, expenseId: id }, err)
      toast({
        title: t('toast.deleteError.title'),
        variant: 'destructive',
      })
    }
  }

  // Show loading state while group is loading
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Show message when no group selected
  if (!groupId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t('expenses.noGroup.title')}</h2>
        <p className="text-muted-foreground">{t('expenses.noGroup.description')}</p>
      </div>
    )
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
