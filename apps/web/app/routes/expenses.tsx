import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AddExpenseDialog } from '@/components/AddExpenseDialog';
import { ExpenseCard } from '@/components/ExpenseCard';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import { useAuth, useTelegram, useGroup } from '@/providers';
import { type Expense, type User, type CreateExpenseInput, type UserExpense, api } from '@/services';
import { formatAmount, logger } from '@/utils';

const UNDO_WINDOW_MS = 5000;

export default function ExpensesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hapticFeedback } = useTelegram();
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'owe'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Find current user's member UUID in the group
  // This is needed because expenses use member UUIDs, not Telegram IDs
  const currentMemberId = useMemo(() => {
    if (!user?.id || members.length === 0) return '';
    const currentMember = members.find((m) => m.telegramId === user.id);
    return currentMember?.id || '';
  }, [user?.id, members]);

  // Get the current group's currency
  const currentGroupCurrency = userGroups.find((g) => g.id === groupId)?.currency;

  // Track pending deletion timeouts for cleanup
  const pendingDeletionsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Fetch data based on whether we have a group selected or not
  useEffect(() => {
    if (groupLoading) return;

    const abortController = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      try {
        if (groupId) {
          // GROUP VIEW: Fetch group (with members) and expenses
          const [groupData, expensesData] = await Promise.all([api.getGroup(groupId), api.getExpenses(groupId)]);
          if (!abortController.signal.aborted) {
            setMembers(groupData.members);
            setExpenses(expensesData);
          }
        } else {
          // USER VIEW: Fetch all user expenses
          const userExpensesData = await api.getUserExpenses(50);
          if (!abortController.signal.aborted) {
            setUserExpenses(userExpensesData);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('Failed to load expenses data', { groupId }, err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      abortController.abort();
    };
  }, [groupId, groupLoading]);

  // Cleanup pending deletion timeouts on unmount
  useEffect(() => {
    const currentPendingDeletions = pendingDeletionsRef.current;

    return () => {
      currentPendingDeletions.forEach((timeout) => {
        clearTimeout(timeout);
      });

      currentPendingDeletions.clear();
    };
  }, []);

  // Memoize filtered expenses to avoid recalculation on every render
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (filter) {
        case 'mine':
          return expense.payerId === currentMemberId;
        case 'owe':
          return expense.payerId !== currentMemberId && expense.splits.some((s) => s.userId === currentMemberId);
        default:
          return true;
      }
    });
  }, [expenses, searchQuery, filter, currentMemberId]);

  const handleAddExpense = async (data: CreateExpenseInput) => {
    if (!groupId) return;

    try {
      const newExpense = await api.createExpense(groupId, data);
      setExpenses([newExpense, ...expenses]);
      toast({
        title: t('toast.expenseAdded.title'),
        description: t('toast.expenseAdded.description', {
          description: data.description,
          amount: data.amount,
        }),
        variant: 'success',
      });
    } catch (err) {
      logger.error('Failed to add expense', { groupId }, err);
      toast({
        title: t('toast.expenseError.title'),
        description: t('toast.expenseError.description'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteExpense = (id: string) => {
    if (!groupId) return;

    // Find the expense to delete
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete) return;

    // Optimistically remove from UI
    setExpenses((prev) => prev.filter((e) => e.id !== id));

    // Set up timeout for actual deletion
    let deleteTimeout: ReturnType<typeof setTimeout> | null = null;

    // Show toast with undo action
    const { dismiss } = toast({
      title: t('toast.expenseDeleted.title'),
      description: t('toast.expenseDeleted.description'),
      variant: 'default',
      duration: UNDO_WINDOW_MS, // Ensure toast stays visible for full undo window
      action: (
        <ToastAction
          altText={t('toast.undo')}
          onClick={() => {
            hapticFeedback.notificationOccurred('success');
            // Cancel the deletion timeout
            if (deleteTimeout) {
              clearTimeout(deleteTimeout);
              pendingDeletionsRef.current.delete(deleteTimeout);
            }

            // Restore the expense to the list
            setExpenses((prevExpenses) => [expenseToDelete, ...prevExpenses]);
            dismiss();
          }}
        >
          {t('toast.undo')}
        </ToastAction>
      ),
    });

    // Schedule actual deletion after 5 seconds
    deleteTimeout = setTimeout(() => {
      void (async () => {
        try {
          await api.deleteExpense(groupId, id);
          hapticFeedback.notificationOccurred('success');
          dismiss();
          toast({
            title: t('toast.expenseDeletedPermanently.title'),
            variant: 'success',
          });
        } catch (err) {
          logger.error('Failed to delete expense', { groupId, expenseId: id }, err);
          hapticFeedback.notificationOccurred('error');
          // Restore expense on error
          setExpenses((prevExpenses) => [expenseToDelete, ...prevExpenses]);
          dismiss();
          toast({
            title: t('toast.deleteError.title'),
            variant: 'destructive',
          });
        } finally {
          // Remove from pending deletions after completion
          if (deleteTimeout) {
            pendingDeletionsRef.current.delete(deleteTimeout);
          }
        }
      })();
    }, UNDO_WINDOW_MS);

    // Track the timeout for cleanup
    pendingDeletionsRef.current.add(deleteTimeout);
  };

  // Show loading state while group is loading
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  // USER VIEW: Show all expenses grouped by group
  if (!groupId) {
    // Group user expenses by group
    const expensesByGroup = userExpenses.reduce<
      Record<string, { groupId: string; groupTitle: string; expenses: UserExpense[] }>
    >((acc, expense) => {
      if (!acc[expense.groupId]) {
        acc[expense.groupId] = {
          groupId: expense.groupId,
          groupTitle: expense.groupTitle,
          expenses: [],
        };
      }

      acc[expense.groupId].expenses.push(expense);

      return acc;
    }, {});

    const groupedExpenses = Object.values(expensesByGroup);

    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 flex flex-col motion-safe:duration-200">
        {/* Header */}
        <div className="bg-background sticky top-0 z-30 space-y-4 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('userDashboard.allExpenses')}</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={t('expenses.search')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="pr-9 pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                }}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expenses by Group */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4 pb-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
              </div>
            ) : groupedExpenses.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center">
                <p className="text-muted-foreground">{t('expenses.empty.title')}</p>
                <p className="text-muted-foreground text-sm">{t('expenses.empty.description')}</p>
              </div>
            ) : (
              groupedExpenses.map((group) => {
                const filteredGroupExpenses = group.expenses.filter((expense) =>
                  expense.description.toLowerCase().includes(searchQuery.toLowerCase()),
                );

                if (filteredGroupExpenses.length === 0) return null;

                return (
                  <div key={group.groupId} className="space-y-3">
                    <button
                      onClick={() => {
                        void setGroupId(group.groupId);
                      }}
                      className="hover:bg-muted/50 -ml-2 flex w-full items-center justify-between rounded-lg p-2 text-left motion-safe:transition-colors motion-reduce:transition-none"
                    >
                      <h2 className="text-muted-foreground text-sm font-semibold">{group.groupTitle}</h2>
                      <ChevronRight className="text-muted-foreground h-4 w-4" />
                    </button>
                    {filteredGroupExpenses.slice(0, 5).map((expense) => (
                      <Card key={expense.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <TextTrimmer text={expense.description} maxLength={22} className="font-medium" />
                              <p className="text-muted-foreground text-xs">
                                {t('expenses.paidBy', { name: '' })}
                                <TextTrimmer text={expense.payerName} maxLength={12} className="inline" />
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {formatAmount(expense.amount)} {expense.currency}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {t('expenses.yourShare', { amount: formatAmount(expense.yourShare) })}
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
                        onClick={() => {
                          void setGroupId(group.groupId);
                        }}
                      >
                        {t('home.viewAll')} ({filteredGroupExpenses.length})
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        <ScrollToTopButton />
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 flex flex-col motion-safe:duration-200">
      {/* Header */}
      <div className="bg-background sticky top-0 z-30 space-y-4 border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            {userGroups.length > 1 && (
              <Button variant="ghost" size="sm" onClick={clearGroupSelection} className="text-muted-foreground -ml-2">
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('home.allGroups')}
              </Button>
            )}
            <h1 className="text-xl font-bold">{t('expenses.title')}</h1>
          </div>
          <AddExpenseDialog members={members} currentUserId={currentMemberId} currency={currentGroupCurrency} onSubmit={handleAddExpense} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t('expenses.search')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="pr-9 pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as typeof filter);
          }}
        >
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
        <div className="space-y-3 p-4 pb-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p className="text-muted-foreground">{t('expenses.empty.title')}</p>
              <p className="text-muted-foreground text-sm">{t('expenses.empty.description')}</p>
            </div>
          ) : (
            filteredExpenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                currentUserId={currentMemberId}
                onDelete={handleDeleteExpense}
              />
            ))
          )}
        </div>
      </ScrollArea>
      <ScrollToTopButton />
    </div>
  );
}
