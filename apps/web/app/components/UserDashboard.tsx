import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Users from 'lucide-react/dist/esm/icons/users';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { WalletButton } from '@/components/WalletButton';
import { useFormatTimeAgo } from '@/hooks';
import { useAuth, useGroup } from '@/providers';
import { api, type UserActivityItem } from '@/services';
import { formatAmount, formatCurrency, logger } from '@/utils';

export function UserDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userGroups, setGroupId } = useGroup();
  const [activity, setActivity] = useState<UserActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate total balance and breakdown across all groups
  const totalBalance = userGroups.reduce((sum, g) => sum + g.balance, 0);
  const totalOwed = userGroups.reduce((sum, g) => (g.balance > 0 ? sum + g.balance : sum), 0);
  const totalOwe = userGroups.reduce((sum, g) => (g.balance < 0 ? sum + Math.abs(g.balance) : sum), 0);
  const isOwed = totalBalance > 0;

  // Fetch user activity on mount
  useEffect(() => {
    const loadActivity = async () => {
      setIsLoading(true);
      try {
        const activityData = await api.getUserActivity(10);
        setActivity(activityData);
      } catch (err) {
        logger.error('Failed to load user activity', {}, err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadActivity();
  }, []);

  const formatTimeAgo = useFormatTimeAgo();

  const handleGroupClick = (groupId: string) => {
    void setGroupId(groupId);
  };

  // Empty state - no groups
  if (userGroups.length === 0) {
    return (
      <div className="space-y-4 p-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('userDashboard.greeting', { name: user?.firstName ?? 'there' })}</h1>
            <p className="text-muted-foreground text-sm">{t('userDashboard.subtitle')}</p>
          </div>
          <WalletButton />
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <Users className="text-muted-foreground h-16 w-16" />
          <h2 className="text-xl font-semibold">{t('userDashboard.noGroups')}</h2>
          <p className="text-muted-foreground max-w-sm">{t('home.noGroup.description')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('userDashboard.greeting', { name: user?.firstName ?? 'there' })}</h1>
          <p className="text-muted-foreground text-sm">{t('userDashboard.subtitle')}</p>
        </div>
        <WalletButton />
      </div>

      {/* Total Balance Card */}
      <Card
        className={
          isOwed
            ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
            : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
        }
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{t('userDashboard.totalBalance')}</p>
              <p
                className={`text-3xl font-bold ${isOwed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {isOwed ? '+' : ''}
                {formatCurrency(totalBalance)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('userDashboard.acrossGroups', { count: userGroups.length })}
              </p>
            </div>
            <div
              className={`rounded-full p-3 ${isOwed ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}
            >
              {isOwed ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          {/* Balance breakdown */}
          <div className="mt-4 flex gap-4 border-t pt-4">
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">{t('userDashboard.youOwe')}</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalOwe)}</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-muted-foreground text-xs">{t('userDashboard.owedToYou')}</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">{formatCurrency(totalOwed)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('userDashboard.yourGroups')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {userGroups.map((group) => {
            const groupIsOwed = group.balance > 0;
            const hasBalance = group.balance !== 0;

            return (
              <button
                key={group.id}
                onClick={() => {
                  handleGroupClick(group.id);
                }}
                className="hover:bg-muted/50 bg-muted/20 flex w-full items-center gap-3 rounded-xl p-3 text-left active:scale-[0.98] motion-safe:transition-all motion-reduce:transition-none"
              >
                {/* Avatar */}
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                    {group.title.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {/* Title row */}
                  <TextTrimmer text={group.title} maxLength={20} className="font-semibold" />

                  {/* Stats row */}
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span>{group.memberCount}</span>
                    <span className="mx-1">·</span>
                    <Receipt className="h-3 w-3" />
                    <span>{group.expenseCount}</span>
                  </div>
                </div>

                {/* Balance */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      groupIsOwed
                        ? 'text-green-600 dark:text-green-400'
                        : hasBalance
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {hasBalance && (groupIsOwed ? '+' : '')}
                    {formatCurrency(group.balance, group.currency)}
                  </span>
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('userDashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="border-primary h-6 w-6 rounded-full border-2 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{t('userDashboard.noActivity')}</p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{item.description.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{item.description}</p>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span className="bg-muted rounded px-1.5 py-0.5">{item.groupTitle}</span>
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <span className="text-primary font-medium">
                  {formatAmount(item.amount)} {item.currency}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
