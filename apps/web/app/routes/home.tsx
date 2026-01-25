import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, TrendingUp, TrendingDown, Users, Receipt, ChevronLeft } from 'lucide-react'
import { useTelegram, useGroup } from '@/providers'
import { type DebtGraph as DebtGraphType, type UserActivityItem, api } from '@/services'
import { formatTON, logger } from '@/utils'
import { DebtGraph } from '@/components/DebtGraph'
import { UserDashboard } from '@/components/UserDashboard'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { groupId, group, isLoading: groupLoading, clearGroupSelection } = useGroup()
  const navigate = useNavigate()
  const [debtGraph, setDebtGraph] = useState<DebtGraphType | null>(null)
  const [recentActivity, setRecentActivity] = useState<UserActivityItem[]>([])
  const [expenseCount, setExpenseCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const userNode = debtGraph?.nodes.find((n) => n.name === 'You')
  const userBalance = userNode?.balance ?? 0
  const isOwed = userBalance > 0

  useEffect(() => {
    if (!groupId || groupLoading) return

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      try {
        // Fetch debt graph, expenses, and activity in parallel
        const [debtData, expenses, activity] = await Promise.all([
          api.getDebts(groupId),
          api.getExpenses(groupId),
          api.getUserActivity(5),
        ])
        if (!abortController.signal.aborted) {
          setDebtGraph(debtData.graph)
          setExpenseCount(expenses.length)
          setRecentActivity(activity)
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return
        logger.error('Failed to load data', { groupId }, err)
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadData()

    // Cleanup: abort pending requests on unmount
    return () => abortController.abort()
  }, [groupId, groupLoading])

  const formatTimeAgo = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const hours = diffMs / (1000 * 60 * 60)

    if (hours < 1) return t('home.justNow')
    if (hours < 24) return t('home.hoursAgo', { count: Math.floor(hours) })
    const days = Math.floor(hours / 24)
    return t('home.daysAgo', { count: days })
  }, [t])

  // Show loading state while group is loading or no group selected
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!groupId || !group) {
    return <UserDashboard />
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearGroupSelection}
            className="-ml-2 text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('home.allGroups')}
          </Button>
          <h1 className="text-2xl font-bold">
            {t('home.greeting', { name: user?.first_name ?? 'there' })}
          </h1>
          <p className="text-sm text-muted-foreground">{group.title}</p>
        </div>
        <WalletButton />
      </div>

      {/* Balance Card */}
      <Card className={isOwed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isOwed ? t('home.youAreOwed') : t('home.youOwe')}
              </p>
              <p className={`text-3xl font-bold ${isOwed ? 'text-green-600' : 'text-red-600'}`}>
                {formatTON(Math.abs(userBalance))} TON
              </p>
            </div>
            <div className={`rounded-full p-3 ${isOwed ? 'bg-green-100' : 'bg-red-100'}`}>
              {isOwed ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
          {!isOwed && userBalance !== 0 && (
            <Button
              variant="ton"
              className="mt-4 w-full"
              onClick={() => navigate('/settle')}
            >
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
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : debtGraph ? (
            <DebtGraph
              data={debtGraph}
              onNodeClick={(node) => logger.debug('Node clicked', { nodeId: node.id })}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              {t('home.noDebts')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => navigate('/expenses')}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{expenseCount}</p>
              <p className="text-xs text-muted-foreground">{t('home.expenses')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{group?.memberCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('home.members')}</p>
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
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('home.noActivity')}
            </p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {activity.description.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
                <span className="font-medium text-primary">
                  {formatTON(activity.amount)} {activity.currency}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
