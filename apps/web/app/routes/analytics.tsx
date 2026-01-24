import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, TrendingUp, Download, Users, PieChart } from 'lucide-react'
import { useGroup } from '@/lib/group-context'
import { api, type GroupAnalytics } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { groupId, isLoading: groupLoading } = useGroup()
  const [analytics, setAnalytics] = useState<GroupAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!groupId || groupLoading) return

    const loadAnalytics = async () => {
      setIsLoading(true)
      try {
        const data = await api.getGroupAnalytics(groupId)
        setAnalytics(data)
      } catch (err) {
        logger.error('Failed to load analytics', { groupId }, err)
      } finally {
        setIsLoading(false)
      }
    }
    loadAnalytics()
  }, [groupId, groupLoading])

  const handleExport = async (format: 'csv' | 'html', type: 'expenses' | 'settlements' | 'full') => {
    if (!groupId) return
    setIsExporting(true)
    try {
      const blob = await api.exportGroupData(groupId, format, type)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fracti-${type}-${groupId}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      logger.error('Export failed', { groupId, format, type }, err)
    } finally {
      setIsExporting(false)
    }
  }

  if (groupLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!groupId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t('analytics.noGroup.title')}</h2>
        <p className="text-muted-foreground">{t('analytics.noGroup.description')}</p>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
        <BarChart3 className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{t('analytics.noData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-sm text-muted-foreground">{analytics.groupTitle}</p>
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
              <div className="rounded-lg bg-blue-100 p-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTON(analytics.totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{t('analytics.totalExpenses')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.expenseCount}</p>
                <p className="text-xs text-muted-foreground">{t('analytics.expenseCount')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.memberStats.length}</p>
                <p className="text-xs text-muted-foreground">{t('analytics.members')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2">
                <PieChart className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTON(analytics.averageExpense)}</p>
                <p className="text-xs text-muted-foreground">{t('analytics.avgExpense')}</p>
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('analytics.paid')}: {formatTON(member.totalPaid)} {analytics.currency}
                      </p>
                    </div>
                  </div>
                  <span className={`font-medium ${member.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {member.balance >= 0 ? '+' : ''}{formatTON(member.balance)} {analytics.currency}
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
                <p className="text-center text-muted-foreground">{t('analytics.noCategories')}</p>
              ) : (
                analytics.categoryBreakdown.map((cat) => {
                  const percentage = (cat.amount / analytics.totalExpenses) * 100
                  return (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{cat.category}</span>
                        <span className="text-muted-foreground">
                          {formatTON(cat.amount)} {analytics.currency} ({cat.count})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
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
                <p className="text-center text-muted-foreground">{t('analytics.noTrend')}</p>
              ) : (
                analytics.monthlyTrend.map((month) => {
                  const maxAmount = Math.max(...analytics.monthlyTrend.map((m) => m.amount))
                  const percentage = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0
                  return (
                    <div key={month.month} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{month.month}</span>
                        <span className="text-muted-foreground">
                          {formatTON(month.amount)} {analytics.currency}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
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
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className="font-medium text-primary">
                {formatTON(expense.amount)} {analytics.currency}
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
  )
}
