import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down'
import Users from 'lucide-react/dist/esm/icons/users'
import Plus from 'lucide-react/dist/esm/icons/plus'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import { useGroup, useTelegram } from '@/providers'
import { api, type UserActivityItem } from '@/services'
import { formatTON, logger } from '@/utils'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function UserDashboard() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { userGroups, setGroupId } = useGroup()
  const [activity, setActivity] = useState<UserActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Calculate total balance and breakdown across all groups
  const totalBalance = userGroups.reduce((sum, g) => sum + g.balance, 0)
  const totalOwed = userGroups.reduce((sum, g) => g.balance > 0 ? sum + g.balance : sum, 0)
  const totalOwe = userGroups.reduce((sum, g) => g.balance < 0 ? sum + Math.abs(g.balance) : sum, 0)
  const isOwed = totalBalance > 0

  // Fetch user activity on mount
  useEffect(() => {
    const loadActivity = async () => {
      setIsLoading(true)
      try {
        const activityData = await api.getUserActivity(10)
        setActivity(activityData)
      } catch (err) {
        logger.error('Failed to load user activity', {}, err)
      } finally {
        setIsLoading(false)
      }
    }
    loadActivity()
  }, [])

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

  const handleGroupClick = (groupId: string) => {
    setGroupId(groupId)
  }

  // Empty state - no groups
  if (userGroups.length === 0) {
    return (
      <div className="space-y-6 p-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t('userDashboard.greeting', { name: user?.first_name ?? 'there' })}
            </h1>
            <p className="text-sm text-muted-foreground">{t('userDashboard.subtitle')}</p>
          </div>
          <WalletButton />
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <Users className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{t('userDashboard.noGroups')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {t('home.noGroup.description')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {t('userDashboard.greeting', { name: user?.first_name ?? 'there' })}
          </h1>
          <p className="text-sm text-muted-foreground">{t('userDashboard.subtitle')}</p>
        </div>
        <WalletButton />
      </div>

      {/* Total Balance Card */}
      <Card className={isOwed ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('userDashboard.totalBalance')}
              </p>
              <p className={`text-3xl font-bold ${isOwed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isOwed ? '+' : ''}{formatTON(totalBalance)} TON
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('userDashboard.acrossGroups', { count: userGroups.length })}
              </p>
            </div>
            <div className={`rounded-full p-3 ${isOwed ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
              {isOwed ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
          </div>
          {/* Balance breakdown */}
          <div className="flex gap-4 mt-4 pt-4 border-t">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{t('userDashboard.youOwe')}</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                {formatTON(totalOwe)} TON
              </p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-muted-foreground">{t('userDashboard.owedToYou')}</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {formatTON(totalOwed)} TON
              </p>
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
        <CardContent className="space-y-2">
          {userGroups.map((group) => {
            const groupIsOwed = group.balance > 0
            return (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {group.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{group.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.memberCount} {t('userDashboard.members')} · {group.expenseCount} {t('home.expenses').toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${groupIsOwed ? 'text-green-600 dark:text-green-400' : group.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {group.balance !== 0 && (groupIsOwed ? '+' : '')}{formatTON(group.balance)} TON
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            )
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('userDashboard.noActivity')}
            </p>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {item.description.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{item.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted">{item.groupTitle}</span>
                      <span>{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <span className="font-medium text-primary">
                  {formatTON(item.amount)} {item.currency}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
