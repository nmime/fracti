import { useState } from 'react'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Users from 'lucide-react/dist/esm/icons/users'
import type { User, CreateExpenseInput } from '@/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/utils'

interface AddExpenseDialogProps {
  members: User[]
  currentUserId: string
  onSubmit: (data: CreateExpenseInput) => Promise<void>
}

export function AddExpenseDialog({
  members,
  currentUserId,
  onSubmit,
}: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !amount || selectedMembers.length === 0) return

    setIsLoading(true)
    try {
      const splitAmount = parseFloat(amount) / selectedMembers.length
      await onSubmit({
        payerId: currentUserId,
        amount: parseFloat(amount),
        description,
        splitType: 'equal',
        splits: selectedMembers.map((userId) => ({
          userId,
          amount: splitAmount,
        })),
      })
      setOpen(false)
      setDescription('')
      setAmount('')
      setSelectedMembers([])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAll = () => {
    setSelectedMembers(members.map((m) => m.id))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Enter the expense details and select who to split with.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Dinner, groceries, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (TON)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Split with</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                >
                  <Users className="mr-1 h-3 w-3" />
                  Select All
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((member) => {
                  const isSelected = selectedMembers.includes(member.id)
                  const isCurrentUser = member.id === currentUserId
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-accent'
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {isCurrentUser ? 'You' : member.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            {selectedMembers.length > 0 && amount && (
              <p className="text-sm text-muted-foreground">
                Each person pays:{' '}
                <span className="font-medium text-foreground">
                  {(parseFloat(amount) / selectedMembers.length).toFixed(2)} TON
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !description ||
                !amount ||
                selectedMembers.length === 0
              }
            >
              {isLoading ? 'Adding...' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
