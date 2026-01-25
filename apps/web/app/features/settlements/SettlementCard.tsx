import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Check from 'lucide-react/dist/esm/icons/check'
import Clock from 'lucide-react/dist/esm/icons/clock'
import X from 'lucide-react/dist/esm/icons/x'
import type { Settlement } from '@/services/api'
import { formatTON, shortenAddress } from '@/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/**
 * Settlement Card Component
 * Displays a settlement with status and payment action
 */

type PaymentType = 'TON' | 'USDT' | 'USDC'

interface SettlementCardProps {
  settlement: Settlement
  onPay?: (settlement: Settlement) => void
  currentUserId?: string
  isLoading?: boolean
  paymentType?: PaymentType
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    label: 'Pending',
  },
  completed: {
    icon: Check,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950',
    label: 'Completed',
  },
  failed: {
    icon: X,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950',
    label: 'Failed',
  },
}

export function SettlementCard({
  settlement,
  onPay,
  currentUserId,
  isLoading,
  paymentType = 'TON',
}: SettlementCardProps) {
  const isFromUser = settlement.fromUserId === currentUserId
  const status = statusConfig[settlement.status]
  const StatusIcon = status.icon
  const currencyLabel = paymentType

  return (
    <Card className={`overflow-hidden ${status.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-red-100 text-red-600">
                  {settlement.fromUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="mt-1 text-xs text-muted-foreground">
                {isFromUser ? 'You' : settlement.fromUserName}
              </span>
            </div>

            <div className="flex flex-col items-center px-2">
              <div className="flex items-center gap-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-primary">
                {formatTON(settlement.amount)} TON
              </span>
            </div>

            <div className="flex flex-col items-center">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-green-100 text-green-600">
                  {settlement.toUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="mt-1 text-xs text-muted-foreground">
                {settlement.toUserId === currentUserId ? 'You' : settlement.toUserName}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {settlement.status === 'pending' && isFromUser && onPay ? (
              <Button
                variant="ton"
                size="sm"
                onClick={() => onPay(settlement)}
                disabled={isLoading}
              >
                {isLoading ? 'Paying...' : `Pay ${currencyLabel}`}
              </Button>
            ) : (
              <div className={`flex items-center gap-1 ${status.color}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
            )}
            {settlement.txHash && (
              <a
                href={`https://tonviewer.com/transaction/${settlement.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {shortenAddress(settlement.txHash)}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
