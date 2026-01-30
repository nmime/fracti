import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Users from 'lucide-react/dist/esm/icons/users';
import type { Expense } from '@/services';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { formatCurrency } from '@/utils';

interface ExpenseCardProps {
  expense: Expense;
  onDelete?: (id: string) => void;
  currentUserId?: string;
}

export function ExpenseCard({ expense, onDelete, currentUserId }: ExpenseCardProps) {
  const isPayer = expense.payerId === currentUserId;
  const userSplit = expense.splits.find((s) => s.userId === currentUserId);
  const owes = userSplit && !isPayer ? userSplit.amount : 0;

  return (
    <Card className="overflow-hidden motion-safe:transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {expense.payerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <TextTrimmer text={expense.description} maxLength={25} className="leading-none font-medium" />
              <p className="text-muted-foreground text-sm">
                Paid by {isPayer ? 'you' : <TextTrimmer text={expense.payerName} maxLength={15} className="inline" />}
              </p>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Users className="h-3 w-3" />
                <span>{expense.splits.length} people</span>
                <span className="mx-1">·</span>
                <span>{new Date(expense.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-primary font-semibold">{formatCurrency(expense.amount, expense.currency)}</span>
            {owes > 0 && <span className="text-destructive text-xs">You owe {formatCurrency(owes, expense.currency)}</span>}
            {isPayer && <span className="text-xs text-green-600 dark:text-green-400">You paid</span>}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                onClick={() => {
                  onDelete(expense.id);
                }}
                aria-label={`Delete expense: ${expense.description}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
