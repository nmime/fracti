import { DefaultCurrency } from '@libs/types';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Users from 'lucide-react/dist/esm/icons/users';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, CreateExpenseInput } from '@/services';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useTelegram } from '@/providers';
import { cn } from '@/utils';

interface AddExpenseDialogProps {
  members: User[];
  currentUserId: string;
  currency?: string;
  onSubmit: (data: CreateExpenseInput) => Promise<void>;
}

export function AddExpenseDialog({ members, currentUserId, currency = DefaultCurrency, onSubmit }: AddExpenseDialogProps) {
  const { t } = useTranslation();
  const { hapticFeedback } = useTelegram();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || selectedMembers.length === 0) return;

    setIsLoading(true);
    try {
      const splitAmount = parseFloat(amount) / selectedMembers.length;
      await onSubmit({
        payerId: currentUserId,
        amount: parseFloat(amount),
        description,
        splitType: 'equal',
        splits: selectedMembers.map((userId) => ({
          userId,
          amount: splitAmount,
        })),
      });

      hapticFeedback.notificationOccurred('success');
      setOpen(false);
      setDescription('');
      setAmount('');
      setSelectedMembers([]);
    } catch (error) {
      hapticFeedback.notificationOccurred('error');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    hapticFeedback.selectionChanged();
    setSelectedMembers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const selectAll = () => {
    setSelectedMembers(members.map((m) => m.id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addExpense.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('addExpense.title')}</DialogTitle>
            <DialogDescription>{t('addExpense.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> {t('addExpense.requiredFields')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="description" required>
                {t('addExpense.descriptionLabel')}
              </Label>
              <Input
                id="description"
                placeholder={t('addExpense.descriptionPlaceholder')}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" required>
                {t('addExpense.amountLabel', { currency })}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label required>{t('addExpense.splitWith')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                  <Users className="mr-1 h-3 w-3" />
                  {t('addExpense.selectAll')}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((member) => {
                  const isSelected = selectedMembers.includes(member.id);
                  const isCurrentUser = member.id === currentUserId;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        toggleMember(member.id);
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent',
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-sm">
                        {isCurrentUser ? t('common.you') : <TextTrimmer text={member.name} maxLength={10} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedMembers.length > 0 && amount && (
              <p className="text-muted-foreground text-sm">
                {t('addExpense.eachPersonPays')}{' '}
                <span className="text-foreground font-medium">
                  {(parseFloat(amount) / selectedMembers.length).toFixed(2)} {currency}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !description || !amount || selectedMembers.length === 0}>
              {isLoading ? t('common.adding') : t('addExpense.button')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
