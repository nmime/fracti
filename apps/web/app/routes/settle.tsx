import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, AlertCircle, Coins, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/lib/telegram'
import { useGroup } from '@/lib/group-context'
import { useTonPayment, type JettonType } from '@/lib/ton'
import { type Settlement, type DebtNode, type UserSettlement, api } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { SettlementCard } from '@/components/SettlementCard'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

type PaymentType = 'TON' | 'USDT' | 'USDC'

const paymentOptions: { type: PaymentType; label: string; color: string }[] = [
  { type: 'TON', label: 'TON', color: 'bg-blue-500' },
  { type: 'USDT', label: 'USDT', color: 'bg-green-500' },
  { type: 'USDC', label: 'USDC', color: 'bg-blue-400' },
]

export default function SettlePage() {
  const { t } = useTranslation()
  const { user, hapticFeedback } = useTelegram()
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup()
  const { toast } = useToast()
  const { isConnected, sendTransaction, sendJettonTransaction } = useTonPayment()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [userSettlements, setUserSettlements] = useState<UserSettlement[]>([])
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({})
  const [payingId, setPayingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>('TON')

  // Use Telegram user ID when available
  const currentUserId = user?.id ? String(user.id) : ''

  // Fetch settlements from API on mount
  useEffect(() => {
    if (groupLoading) return

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      try {
        if (groupId) {
          // GROUP VIEW: Fetch group settlements and debts
          const [settlementsData, debtsData] = await Promise.all([
            api.getSettlements(groupId),
            api.getDebts(groupId),
          ])
          if (!abortController.signal.aborted) {
            setSettlements(settlementsData)
            // Build wallet addresses map from debt nodes
            const wallets: Record<string, string> = {}
            debtsData.graph.nodes.forEach((node: DebtNode) => {
              if (node.wallet) {
                wallets[node.id] = node.wallet
              }
            })
            setWalletAddresses(wallets)
          }
        } else {
          // USER VIEW: Fetch all user settlements
          const userSettlementsData = await api.getUserSettlements(50)
          if (!abortController.signal.aborted) {
            setUserSettlements(userSettlementsData)
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        logger.error('Failed to load data', { groupId }, err)
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    loadData()

    return () => abortController.abort()
  }, [groupId, groupLoading])

  // Memoize settlement calculations to avoid recalculation on every render
  const { pendingSettlements, completedSettlements, totalOwed, totalToReceive } = useMemo(() => {
    const pending = settlements.filter((s) => s.status === 'pending')
    const completed = settlements.filter((s) => s.status === 'completed')

    const owed = pending
      .filter((s) => s.fromUserId === currentUserId)
      .reduce((sum, s) => sum + s.amount, 0)

    const toReceive = pending
      .filter((s) => s.toUserId === currentUserId)
      .reduce((sum, s) => sum + s.amount, 0)

    return {
      pendingSettlements: pending,
      completedSettlements: completed,
      totalOwed: owed,
      totalToReceive: toReceive,
    }
  }, [settlements, currentUserId])

  // Show loading state while group is loading
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // USER VIEW: Show all settlements across groups
  if (!groupId) {
    // Group settlements by group
    const settlementsByGroup = userSettlements.reduce((acc, settlement) => {
      if (!acc[settlement.groupId]) {
        acc[settlement.groupId] = {
          groupId: settlement.groupId,
          groupTitle: settlement.groupTitle,
          settlements: [],
        }
      }
      acc[settlement.groupId].settlements.push(settlement)
      return acc
    }, {} as Record<string, { groupId: string; groupTitle: string; settlements: UserSettlement[] }>)

    const groupedSettlements = Object.values(settlementsByGroup)

    // Calculate total owed and to receive across all groups
    const userTotalOwed = userSettlements
      .filter((s) => s.status === 'pending' && s.fromUserId === currentUserId)
      .reduce((sum, s) => sum + s.amount, 0)
    const userTotalToReceive = userSettlements
      .filter((s) => s.status === 'pending' && s.toUserId === currentUserId)
      .reduce((sum, s) => sum + s.amount, 0)

    return (
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-14 z-30 space-y-4 border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('userDashboard.allSettlements')}</h1>
            <WalletButton />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('settle.youOwe')}</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {formatTON(userTotalOwed)} TON
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t('settle.youllReceive')}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatTON(userTotalToReceive)} TON
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Settlements by Group */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4 pb-20">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : groupedSettlements.length === 0 ? (
              <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <p className="font-medium text-green-700 dark:text-green-400">{t('settle.allSettled.title')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settle.allSettled.description')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              groupedSettlements.map((group) => {
                const pendingCount = group.settlements.filter((s) => s.status === 'pending').length
                return (
                  <div key={group.groupId} className="space-y-3">
                    <button
                      onClick={() => setGroupId(group.groupId)}
                      className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded-lg p-2 -ml-2 transition-colors"
                    >
                      <div>
                        <h2 className="text-sm font-semibold text-muted-foreground">
                          {group.groupTitle}
                        </h2>
                        {pendingCount > 0 && (
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            {t('settle.pending', { count: pendingCount })}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {group.settlements.filter((s) => s.status === 'pending').slice(0, 3).map((settlement) => (
                      <Card key={settlement.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {settlement.fromUserId === currentUserId
                                  ? settlement.toUserName
                                  : settlement.fromUserName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {settlement.fromUserId === currentUserId
                                  ? t('settle.youOwe')
                                  : t('settle.owesYou')}
                              </p>
                            </div>
                            <span className={`font-medium ${settlement.fromUserId === currentUserId ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatTON(settlement.amount)} {settlement.currency}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {group.settlements.filter((s) => s.status === 'pending').length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setGroupId(group.groupId)}
                      >
                        {t('home.viewAll')} ({group.settlements.filter((s) => s.status === 'pending').length})
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

  const handlePay = async (settlement: Settlement) => {
    if (!isConnected) {
      toast({
        title: t('toast.walletNotConnected.title'),
        description: t('toast.walletNotConnected.description'),
        variant: 'destructive',
      })
      return
    }

    const recipientWallet = walletAddresses[settlement.toUserId]
    if (!recipientWallet) {
      toast({
        title: t('toast.noWalletAddress.title'),
        description: t('toast.noWalletAddress.description', { name: settlement.toUserName }),
        variant: 'destructive',
      })
      return
    }

    setPayingId(settlement.id)
    hapticFeedback.impactOccurred('medium')

    try {
      let boc: string

      if (selectedPaymentType === 'TON') {
        // Standard TON transfer
        boc = await sendTransaction({
          to: recipientWallet,
          amount: settlement.amount,
          comment: `Fracti Settlement #${settlement.id}`,
        })
      } else {
        // Jetton (USDT/USDC) transfer
        boc = await sendJettonTransaction({
          to: recipientWallet,
          amount: settlement.amount,
          jettonType: selectedPaymentType as JettonType,
          comment: `Fracti Settlement #${settlement.id}`,
        })
      }

      // Confirm settlement with the API
      try {
        await api.confirmSettlement(groupId, settlement.id, boc)
      } catch (apiErr) {
        logger.warn('Failed to confirm settlement with API, updating locally', { settlementId: settlement.id }, apiErr)
      }

      // Update local settlement status
      setSettlements((prev) =>
        prev.map((s) =>
          s.id === settlement.id
            ? { ...s, status: 'completed', txHash: boc }
            : s
        )
      )

      hapticFeedback.notificationOccurred('success')
      toast({
        title: t('toast.paymentSent.title'),
        description: t('toast.paymentSent.description', {
          amount: formatTON(settlement.amount),
          name: settlement.toUserName
        }),
        variant: 'success',
      })
    } catch (error) {
      logger.error('Payment failed', { settlementId: settlement.id, paymentType: selectedPaymentType }, error)
      hapticFeedback.notificationOccurred('error')
      toast({
        title: t('toast.paymentError.title'),
        description: t('toast.paymentError.description', {
          error: error instanceof Error ? error.message : 'Please try again'
        }),
        variant: 'destructive',
      })
    } finally {
      setPayingId(null)
    }
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
            <h1 className="text-xl font-bold">{t('settle.title')}</h1>
          </div>
          <WalletButton />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('settle.youOwe')}</p>
              <p className="text-xl font-bold text-red-600">
                {formatTON(totalOwed)} TON
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('settle.youllReceive')}</p>
              <p className="text-xl font-bold text-green-600">
                {formatTON(totalToReceive)} TON
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Type Selection */}
        {isConnected && pendingSettlements.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('settle.payWith')}:</span>
                <div className="flex flex-1 gap-2">
                  {paymentOptions.map((option) => (
                    <Button
                      key={option.type}
                      variant={selectedPaymentType === option.type ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedPaymentType(option.type)
                        hapticFeedback.selectionChanged()
                      }}
                    >
                      <span className={`mr-1.5 h-2 w-2 rounded-full ${option.color}`} />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isConnected && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">
                  {t('settle.connectWallet')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Settlements List */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4 pb-20">
          {/* Loading State */}
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Pending Settlements */}
              {pendingSettlements.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t('settle.pending', { count: pendingSettlements.length })}
                  </h2>
                  {pendingSettlements.map((settlement) => (
                    <SettlementCard
                      key={settlement.id}
                      settlement={settlement}
                      currentUserId={currentUserId}
                      onPay={handlePay}
                      isLoading={payingId === settlement.id}
                      paymentType={selectedPaymentType}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {!isLoading && pendingSettlements.length === 0 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="flex flex-col items-center gap-2 py-8">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="font-medium text-green-700">{t('settle.allSettled.title')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settle.allSettled.description')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Completed Settlements */}
          {!isLoading && completedSettlements.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <h2 className="text-sm font-medium text-muted-foreground">
                {t('settle.completed', { count: completedSettlements.length })}
              </h2>
              {completedSettlements.map((settlement) => (
                <SettlementCard
                  key={settlement.id}
                  settlement={settlement}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
