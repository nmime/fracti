import { Trash2, Users } from 'lucide-react'
import type { Expense } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface ExpenseCardProps {
  expense: Expense
  onDelete?: (id: string) => void
  currentUserId?: string
}

export function ExpenseCard({ expense, onDelete, currentUserId }: ExpenseCardProps) {
  const isPayer = expense.payerId === currentUserId
  const userSplit = expense.splits.find((s) => s.userId === currentUserId)
  const owes = userSplit && !isPayer ? userSplit.amount : 0

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {expense.payerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-medium leading-none">{expense.description}</p>
              <p className="text-sm text-muted-foreground">
                Paid by {isPayer ? 'you' : expense.payerName}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{expense.splits.length} people</span>
                <span className="mx-1">·</span>
                <span>{new Date(expense.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-semibold text-primary">
              {formatTON(expense.amount)} TON
            </span>
            {owes > 0 && (
              <span className="text-xs text-destructive">
                You owe {formatTON(owes)}
              </span>
            )}
            {isPayer && (
              <span className="text-xs text-green-600">You paid</span>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(expense.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
