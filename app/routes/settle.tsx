import { useState, useMemo } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/lib/telegram'
import { useTonPayment } from '@/lib/ton'
import { type Settlement } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { createDemoSettlements, demoWalletAddresses } from '@/lib/fixtures'
import { SettlementCard } from '@/components/SettlementCard'
import { WalletButton } from '@/components/WalletButton'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

export default function SettlePage() {
  const { t } = useTranslation()
  const { user, hapticFeedback } = useTelegram()
  const { toast } = useToast()
  const { isConnected, sendTransaction } = useTonPayment()
  const [settlements, setSettlements] = useState<Settlement[]>(() => createDemoSettlements())
  const [payingId, setPayingId] = useState<string | null>(null)

  // Use Telegram user ID when available, fallback to demo user '1' for development
  const currentUserId = user?.id ? String(user.id) : '1'

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

  const handlePay = async (settlement: Settlement) => {
    if (!isConnected) {
      toast({
        title: t('toast.walletNotConnected.title'),
        description: t('toast.walletNotConnected.description'),
        variant: 'destructive',
      })
      return
    }

    const recipientWallet = demoWalletAddresses[settlement.toUserId]
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
      const boc = await sendTransaction({
        to: recipientWallet,
        amount: settlement.amount,
        comment: `Fracti Settlement #${settlement.id}`,
      })

      // Update settlement status
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

      // In production: await api.recordSettlement('demo', { ... })
    } catch (error) {
      logger.error('Payment failed', { settlementId: settlement.id }, error)
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
          <h1 className="text-xl font-bold">{t('settle.title')}</h1>
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
                />
              ))}
            </div>
          )}

          {pendingSettlements.length === 0 && (
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
          {completedSettlements.length > 0 && (
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
