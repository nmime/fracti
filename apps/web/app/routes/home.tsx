import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Users from 'lucide-react/dist/esm/icons/users';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserDashboard } from '@/components/UserDashboard';
import { WalletButton } from '@/components/WalletButton';
import { useFormatTimeAgo } from '@/hooks';
import { useAuth, useGroup } from '@/providers';
import { api, type DebtGraph as DebtGraphType, type UserActivityItem } from '@/services';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { formatAmount, formatCurrency, logger } from '@/utils';
const DebtGraph = lazy(() => import('@/components/DebtGraph').then((module) => ({ default: module.DebtGraph })));

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { groupId, group, isLoading: groupLoading, clearGroupSelection } = useGroup();
  const navigate = useNavigate();
  const [debtGraph, setDebtGraph] = useState<DebtGraphType | null>(null);
  const [recentActivity, setRecentActivity] = useState<UserActivityItem[]>([]);
  const [expenseCount, setExpenseCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewKey, setViewKey] = useState(0);

  const userNode = debtGraph?.nodes.find((n) => n.name === 'You');
  const userBalance = userNode?.balance ?? 0;
  const isOwed = userBalance > 0;

  useEffect(() => {
    if (!groupId || groupLoading) return;

    const abortController = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      try {
        // Fetch debt graph, expenses, and activity in parallel
        const [debtData, expenses, activity] = await Promise.all([
          api.getDebts(groupId),
          api.getExpenses(groupId),
          api.getUserActivity(5),
        ]);

        if (!abortController.signal.aborted) {
          setDebtGraph(debtData.graph);
          setExpenseCount(expenses.length);
          setRecentActivity(activity);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('Failed to load data', { groupId }, err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    // Cleanup: abort pending requests on unmount
    return () => {
      abortController.abort();
    };
  }, [groupId, groupLoading]);

  // Track view transitions when groupId changes
  useEffect(() => {
    setViewKey((prev) => prev + 1);
  }, [groupId]);

  const formatTimeAgo = useFormatTimeAgo();

  // Show loading state while group is loading or no group selected
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  if (!groupId || !group) {
    return (
      <div key={`dashboard-${viewKey}`} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-200">
        <UserDashboard />
      </div>
    );
  }

  return (
    <div
      key={`group-${viewKey}`}
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 space-y-4 p-4 pb-4 motion-safe:duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={clearGroupSelection} className="text-muted-foreground -ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t('home.allGroups')}
          </Button>
          <h1 className="text-xl font-bold">{t('home.greeting', { name: user?.firstName ?? 'there' })}</h1>
          <p className="text-muted-foreground text-sm"><TextTrimmer text={group.title} maxLength={25} /></p>
        </div>
        <WalletButton />
      </div>

      {/* Balance Card */}
      <Card className={isOwed ? 'border-success/20 bg-success/10' : 'border-destructive/20 bg-destructive/10'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{isOwed ? t('home.youAreOwed') : t('home.youOwe')}</p>
              <p className={`text-3xl font-bold ${isOwed ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(Math.abs(userBalance), group?.currency)}
              </p>
            </div>
            <div className={`rounded-full p-3 ${isOwed ? 'bg-success/20' : 'bg-destructive/20'}`}>
              {isOwed ? (
                <TrendingUp className="text-success h-6 w-6" />
              ) : (
                <TrendingDown className="text-destructive h-6 w-6" />
              )}
            </div>
          </div>
          {!isOwed && userBalance !== 0 && (
            <Button variant="ton" className="mt-4 w-full" onClick={() => navigate('/settle')}>
              {t('home.settleUp')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Debt Graph */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('home.debtWeb')}</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
            </div>
          ) : debtGraph ? (
            <Suspense
              fallback={
                <div className="flex h-[300px] items-center justify-center">
                  <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
                </div>
              }
            >
              <DebtGraph
                data={debtGraph}
                currency={group?.currency}
                onNodeClick={(node) => {
                  logger.debug('Node clicked', { nodeId: node.id });
                }}
              />
            </Suspense>
          ) : (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center">{t('home.noDebts')}</div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          role="button"
          tabIndex={0}
          className="focus-visible:ring-ring cursor-pointer hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-safe:transition-shadow"
          onClick={() => {
            void navigate('/expenses');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void navigate('/expenses');
            }
          }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 rounded-lg p-2">
              <Receipt className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expenseCount}</p>
              <p className="text-muted-foreground text-xs">{t('home.expenses')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md motion-safe:transition-shadow">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="bg-primary/10 rounded-lg p-2">
              <Users className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{group?.memberCount ?? 0}</p>
              <p className="text-muted-foreground text-xs">{t('home.members')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('home.recentActivity')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/expenses')}>
              {t('home.viewAll')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{t('home.noActivity')}</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{(activity.description || '?').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <TextTrimmer text={activity.description} maxLength={20} className="text-sm font-medium" />
                    <p className="text-muted-foreground text-xs">{formatTimeAgo(activity.createdAt)}</p>
                  </div>
                </div>
                <span className="text-primary font-medium">
                  {formatAmount(activity.amount)} {activity.currency}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
