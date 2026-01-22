import { useState, useEffect } from 'react'
import { Wallet, CheckCircle, AlertCircle } from 'lucide-react'
import { useTelegram } from '@/lib/telegram'
import { useTonPayment } from '@/lib/ton'
import { api, type Settlement, type DebtGraph } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { SettlementCard } from '@/components/SettlementCard'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'

// Demo optimized settlements
const demoSettlements: Settlement[] = [
  {
    id: '1',
    groupId: 'demo',
    fromUserId: '1',
    fromUserName: 'You',
    toUserId: '2',
    toUserName: 'Alice',
    amount: 22.0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    groupId: 'demo',
    fromUserId: '3',
    fromUserName: 'Bob',
    toUserId: '1',
    toUserName: 'You',
    amount: 15.5,
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    groupId: 'demo',
    fromUserId: '4',
    fromUserName: 'Charlie',
    toUserId: '2',
    toUserName: 'Alice',
    amount: 8.0,
    status: 'completed',
    txHash: 'abc123def456...',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
]

// Demo wallet addresses
const memberWallets: Record<string, string> = {
  '1': 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  '2': 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
  '3': 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
  '4': 'EQAXRGnNd0HO2G0J8eHNvJY6nXXgQn8TQtVzLw8NNJS6_Tci',
}

export default function SettlePage() {
  const { user, hapticFeedback } = useTelegram()
  const { toast } = useToast()
  const { isConnected, sendTransaction, address } = useTonPayment()
  const [settlements, setSettlements] = useState<Settlement[]>(demoSettlements)
  const [payingId, setPayingId] = useState<string | null>(null)

  const currentUserId = '1'

  const pendingSettlements = settlements.filter((s) => s.status === 'pending')
  const completedSettlements = settlements.filter((s) => s.status === 'completed')

  const totalOwed = pendingSettlements
    .filter((s) => s.fromUserId === currentUserId)
    .reduce((sum, s) => sum + s.amount, 0)

  const totalToReceive = pendingSettlements
    .filter((s) => s.toUserId === currentUserId)
    .reduce((sum, s) => sum + s.amount, 0)

  const handlePay = async (settlement: Settlement) => {
    if (!isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your TON wallet first',
        variant: 'destructive',
      })
      return
    }

    const recipientWallet = memberWallets[settlement.toUserId]
    if (!recipientWallet) {
      toast({
        title: 'No wallet address',
        description: `${settlement.toUserName} hasn't set up their wallet yet`,
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
        title: 'Payment sent!',
        description: `${formatTON(settlement.amount)} TON sent to ${settlement.toUserName}`,
        variant: 'success',
      })

      // In production: await api.recordSettlement('demo', { ... })
    } catch (error) {
      console.error('Payment failed:', error)
      hapticFeedback.notificationOccurred('error')
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Please try again',
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
          <h1 className="text-xl font-bold">Settle Up</h1>
          <WalletButton />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">You owe</p>
              <p className="text-xl font-bold text-red-600">
                {formatTON(totalOwed)} TON
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">You'll receive</p>
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
                  Connect your wallet to settle payments
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
                Pending ({pendingSettlements.length})
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
                <p className="font-medium text-green-700">All settled up!</p>
                <p className="text-sm text-muted-foreground">
                  No pending payments
                </p>
              </CardContent>
            </Card>
          )}

          {/* Completed Settlements */}
          {completedSettlements.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <h2 className="text-sm font-medium text-muted-foreground">
                Completed ({completedSettlements.length})
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
