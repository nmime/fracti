import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import Clock from 'lucide-react/dist/esm/icons/clock';
import X from 'lucide-react/dist/esm/icons/x';
import type { Settlement } from '@/services';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { formatCurrency, shortenAddress } from '@/utils';

type PaymentType = 'TON' | 'USDT';

interface SettlementCardProps {
  settlement: Settlement;
  onPay?: (settlement: Settlement) => void;
  currentMemberId?: string;
  isLoading?: boolean;
  paymentType?: PaymentType;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    label: 'Pending',
  },
  completed: {
    icon: Check,
    color: 'text-green-500 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950',
    label: 'Completed',
  },
  failed: {
    icon: X,
    color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950',
    label: 'Failed',
  },
};

export function SettlementCard({
  settlement,
  onPay,
  currentMemberId,
  isLoading,
  paymentType = 'TON',
}: SettlementCardProps) {
  const isFromUser = settlement.fromUserId === currentMemberId;
  const status = statusConfig[settlement.status];
  const StatusIcon = status.icon;
  const currencyLabel = paymentType;

  return (
    <Card className={`overflow-hidden ${status.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* From User */}
            <div className="flex flex-col items-center">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
                  {settlement.fromUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground mt-1 text-xs">
                {isFromUser ? 'You' : <TextTrimmer text={settlement.fromUserName} maxLength={10} />}
              </span>
            </div>

            {/* Arrow and Amount */}
            <div className="flex flex-col items-center px-2">
              <div className="flex items-center gap-1">
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </div>
              <span className="text-primary text-sm font-semibold">{formatCurrency(settlement.amount, settlement.currency)}</span>
            </div>

            {/* To User */}
            <div className="flex flex-col items-center">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400">
                  {settlement.toUserName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground mt-1 text-xs">
                {settlement.toUserId === currentMemberId ? 'You' : <TextTrimmer text={settlement.toUserName} maxLength={10} />}
              </span>
            </div>
          </div>

          {/* Status/Action */}
          <div className="flex flex-col items-end gap-2">
            {settlement.status === 'pending' && isFromUser && onPay ? (
              <Button
                variant="ton"
                size="sm"
                onClick={() => {
                  onPay(settlement);
                }}
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
                className="text-primary text-xs hover:underline"
              >
                {shortenAddress(settlement.txHash)}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
