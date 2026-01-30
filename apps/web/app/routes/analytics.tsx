import ArrowDownRight from 'lucide-react/dist/esm/icons/arrow-down-right';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Download from 'lucide-react/dist/esm/icons/download';
import PieChart from 'lucide-react/dist/esm/icons/pie-chart';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Users from 'lucide-react/dist/esm/icons/users';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useGroup } from '@/providers';
import { api, type GroupAnalytics, type UserSummary } from '@/services';
import { formatAmount, logger } from '@/utils';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup();
  const [analytics, setAnalytics] = useState<GroupAnalytics | null>(null);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (groupLoading) return;

    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        if (groupId) {
          // GROUP VIEW: Load group analytics
          const data = await api.getGroupAnalytics(groupId);
          setAnalytics(data);
        } else {
          // USER VIEW: Load user summary
          const summary = await api.getUserSummary();
          setUserSummary(summary);
        }
      } catch (err) {
        logger.error('Failed to load analytics', { groupId }, err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, [groupId, groupLoading]);

  const handleExport = async (format: 'csv' | 'html', type: 'expenses' | 'settlements' | 'full') => {
    if (!groupId) return;
    setIsExporting(true);
    try {
      const blob = await api.exportGroupData(groupId, format, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fracti-${type}-${groupId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Export failed', { groupId, format, type }, err);
    } finally {
      setIsExporting(false);
    }
  };

  if (groupLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  // USER VIEW: Show user summary analytics
  if (!groupId) {
    if (!userSummary) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
          <BarChart3 className="text-muted-foreground h-12 w-12" />
          <p className="text-muted-foreground">{t('analytics.noData')}</p>
        </div>
      );
    }

    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 space-y-4 p-4 pb-4 motion-safe:duration-200">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t('userDashboard.globalAnalytics')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('userDashboard.acrossGroups', { count: userSummary.groupCount })}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                  <ArrowUpRight className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatAmount(userSummary.totalPaid)}</p>
                  <p className="text-muted-foreground text-xs">{t('analytics.paid')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                  <ArrowDownRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatAmount(userSummary.totalReceived)}</p>
                  <p className="text-muted-foreground text-xs">{t('analytics.received')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                  <Receipt className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{userSummary.expenseCount}</p>
                  <p className="text-muted-foreground text-xs">{t('analytics.expenseCount')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900">
                  <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{userSummary.groupCount}</p>
                  <p className="text-muted-foreground text-xs">{t('analytics.groups')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Most Active Group */}
        {userSummary.mostActiveGroup && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('analytics.mostActive')}</CardTitle>
            </CardHeader>
            <CardContent>
              <button
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  void setGroupId(userSummary.mostActiveGroup!.id);
                }}
                className="hover:bg-muted/50 -mx-3 flex w-full items-center justify-between rounded-lg p-3 text-left motion-safe:transition-colors motion-reduce:transition-none"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {userSummary.mostActiveGroup.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <TextTrimmer text={userSummary.mostActiveGroup.title} maxLength={20} className="font-medium" />
                    <p className="text-muted-foreground text-xs">
                      {userSummary.mostActiveGroup.expenseCount} {t('home.expenses').toLowerCase()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Groups List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('userDashboard.yourGroups')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {userGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  void setGroupId(group.id);
                }}
                className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg p-3 text-left motion-safe:transition-colors motion-reduce:transition-none"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {group.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <TextTrimmer text={group.title} maxLength={18} className="font-medium" />
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <BarChart3 className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground">{t('analytics.noData')}</p>
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 space-y-4 p-4 pb-4 motion-safe:duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {userGroups.length > 1 && (
            <Button variant="ghost" size="sm" onClick={clearGroupSelection} className="text-muted-foreground -ml-2">
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('home.allGroups')}
            </Button>
          )}
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground text-sm">{analytics.groupTitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExport('html', 'full')} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" />
          {t('analytics.export')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(analytics.totalExpenses)}</p>
                <p className="text-muted-foreground text-xs">{t('analytics.totalExpenses')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.expenseCount}</p>
                <p className="text-muted-foreground text-xs">{t('analytics.expenseCount')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.memberStats.length}</p>
                <p className="text-muted-foreground text-xs">{t('analytics.members')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900">
                <PieChart className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(analytics.averageExpense)}</p>
                <p className="text-muted-foreground text-xs">{t('analytics.avgExpense')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members">{t('analytics.byMember')}</TabsTrigger>
          <TabsTrigger value="categories">{t('analytics.byCategory')}</TabsTrigger>
          <TabsTrigger value="trend">{t('analytics.trend')}</TabsTrigger>
        </TabsList>

        {/* Member Stats */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('analytics.memberBalances')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.memberStats.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <TextTrimmer text={member.name} maxLength={15} className="font-medium" />
                      <p className="text-muted-foreground text-xs">
                        {t('analytics.paid')}: {formatAmount(member.totalPaid)} {analytics.currency}
                      </p>
                    </div>
                  </div>
                  <span className={`font-medium ${member.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {member.balance >= 0 ? '+' : ''}
                    {formatAmount(member.balance)} {analytics.currency}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Breakdown */}
        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('analytics.categoryBreakdown')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.categoryBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-center">{t('analytics.noCategories')}</p>
              ) : (
                analytics.categoryBreakdown.map((cat) => {
                  const percentage = (cat.amount / analytics.totalExpenses) * 100;

                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{cat.category}</span>
                        <span className="text-muted-foreground">
                          {formatAmount(cat.amount)} {analytics.currency} ({cat.count})
                        </span>
                      </div>
                      <div className="bg-secondary h-2 rounded-full">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Trend */}
        <TabsContent value="trend" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('analytics.monthlyTrend')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.monthlyTrend.length === 0 ? (
                <p className="text-muted-foreground text-center">{t('analytics.noTrend')}</p>
              ) : (
                analytics.monthlyTrend.map((month) => {
                  const maxAmount = Math.max(...analytics.monthlyTrend.map((m) => m.amount));
                  const percentage = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0;

                  return (
                    <div key={month.month} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{month.month}</span>
                        <span className="text-muted-foreground">
                          {formatAmount(month.amount)} {analytics.currency}
                        </span>
                      </div>
                      <div className="bg-secondary h-2 rounded-full">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('analytics.topExpenses')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.topExpenses.slice(0, 5).map((expense, i) => (
            <div key={expense.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <div>
                  <TextTrimmer text={expense.description} maxLength={18} className="font-medium" />
                  <p className="text-muted-foreground text-xs">{new Date(expense.date).toLocaleDateString()}</p>
                </div>
              </div>
              <span className="text-primary font-medium">
                {formatAmount(expense.amount)} {analytics.currency}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('analytics.exportData')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => handleExport('csv', 'expenses')} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.expensesCSV')}
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv', 'settlements')} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.settlementsCSV')}
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv', 'full')} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.fullCSV')}
          </Button>
          <Button variant="outline" onClick={() => handleExport('html', 'full')} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.htmlReport')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
