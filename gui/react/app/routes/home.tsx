import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, TrendingUp, TrendingDown, Users, Receipt } from 'lucide-react'
import { useTelegram } from '@/lib/telegram'
import { type DebtGraph as DebtGraphType, type Group, api } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { demoDebtGraph, demoGroup, demoRecentActivity } from '@/lib/fixtures'
import { DebtGraph } from '@/components/DebtGraph'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function HomePage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const navigate = useNavigate()
  const [debtGraph, setDebtGraph] = useState<DebtGraphType>(demoDebtGraph)
  const [group, setGroup] = useState<Group>(demoGroup)
  const [isLoading, setIsLoading] = useState(false)

  // In production, get groupId from route params (e.g., useParams()) or Telegram start_param
  const groupId = demoGroup.id

  const userNode = debtGraph.nodes.find((n) => n.name === 'You')
  const userBalance = userNode?.balance ?? 0
  const isOwed = userBalance > 0

  useEffect(() => {
    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      try {
        // Fetch group and debt graph in parallel
        const [groupData, debtData] = await Promise.all([
          api.getGroup(groupId),
          api.getDebts(groupId),
        ])
        if (!abortController.signal.aborted) {
          setGroup(groupData)
          setDebtGraph(debtData.graph)
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return
        logger.error('Failed to load data', { groupId }, err)
        // Keep demo data on error
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadData()

    // Cleanup: abort pending requests on unmount
    return () => abortController.abort()
  }, [groupId])

  const formatTimeAgo = useCallback((hours: number) => {
    if (hours < 1) return t('home.justNow')
    if (hours < 24) return t('home.hoursAgo', { count: Math.floor(hours) })
    const days = Math.floor(hours / 24)
    return t('home.daysAgo', { count: days })
  }, [t])

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
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
          ) : (
            <DebtGraph
              data={debtGraph}
              onNodeClick={(node) => logger.debug('Node clicked', { nodeId: node.id })}
            />
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
              <p className="text-2xl font-bold">12</p>
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
              <p className="text-2xl font-bold">{group.memberCount}</p>
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
          {demoRecentActivity.map((activity, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {activity.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {activity.name} {t('home.paid')} {t('home.for')} {activity.item}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(activity.hours)}
                  </p>
                </div>
              </div>
              <span className="font-medium text-primary">
                {formatTON(activity.amount)} TON
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
