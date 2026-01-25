import { useState, useMemo, useEffect } from 'react'
import Search from 'lucide-react/dist/esm/icons/search'
import Users from 'lucide-react/dist/esm/icons/users'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { useTranslation } from 'react-i18next'
import { useTelegram, useGroup } from '@/providers'
import { type Expense, type User, type CreateExpenseInput, type UserExpense, api } from '@/services'
import { formatTON, logger } from '@/utils'
import { ExpenseCard } from '@/components/ExpenseCard'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function ExpensesPage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup()
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine' | 'owe'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Use Telegram user ID when available
  const currentUserId = user?.id ? String(user.id) : ''

  // Fetch data based on whether we have a group selected or not
  useEffect(() => {
    if (groupLoading) return

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      try {
        if (groupId) {
          // GROUP VIEW: Fetch group (with members) and expenses
          const [groupData, expensesData] = await Promise.all([
            api.getGroup(groupId),
            api.getExpenses(groupId),
          ])
          if (!abortController.signal.aborted) {
            setMembers(groupData.members)
            setExpenses(expensesData)
          }
        } else {
          // USER VIEW: Fetch all user expenses
          const userExpensesData = await api.getUserExpenses(50)
          if (!abortController.signal.aborted) {
            setUserExpenses(userExpensesData)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        logger.error('Failed to load expenses data', { groupId }, err)
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

  // USER VIEW: Show all expenses grouped by group
  if (!groupId) {
    // Group user expenses by group
    const expensesByGroup = userExpenses.reduce((acc, expense) => {
      if (!acc[expense.groupId]) {
        acc[expense.groupId] = {
          groupId: expense.groupId,
          groupTitle: expense.groupTitle,
          expenses: [],
        }
      }
      acc[expense.groupId].expenses.push(expense)
      return acc
    }, {} as Record<string, { groupId: string; groupTitle: string; expenses: UserExpense[] }>)

    const groupedExpenses = Object.values(expensesByGroup)

    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-14 z-30 space-y-4 border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('userDashboard.allExpenses')}</h1>
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
        </div>

        {/* Expenses by Group */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4 pb-20">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : groupedExpenses.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center">
                <p className="text-muted-foreground">{t('expenses.empty.title')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('expenses.empty.description')}
                </p>
              </div>
            ) : (
              groupedExpenses.map((group) => {
                const filteredGroupExpenses = group.expenses.filter((expense) =>
                  expense.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                if (filteredGroupExpenses.length === 0) return null

                return (
                  <div key={group.groupId} className="space-y-3">
                    <button
                      onClick={() => setGroupId(group.groupId)}
                      className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 -ml-2 transition-colors"
                    >
                      <h2 className="text-sm font-semibold text-muted-foreground">
                        {group.groupTitle}
                      </h2>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {filteredGroupExpenses.slice(0, 5).map((expense) => (
                      <Card key={expense.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{expense.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('expenses.paidBy', { name: expense.payerName })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatTON(expense.amount)} {expense.currency}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('expenses.yourShare', { amount: formatTON(expense.yourShare) })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredGroupExpenses.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setGroupId(group.groupId)}
                      >
                        {t('home.viewAll')} ({filteredGroupExpenses.length})
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="sticky top-14 z-30 space-y-4 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            {userGroups.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearGroupSelection}
                className="-ml-2 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('home.allGroups')}
              </Button>
            )}
            <h1 className="text-xl font-bold">{t('expenses.title')}</h1>
          </div>
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
