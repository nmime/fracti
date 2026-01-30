import Calendar from 'lucide-react/dist/esm/icons/calendar';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useAuth, useGroup } from '@/providers';
import { api, type RecurringTemplate, type CreateRecurringInput, type User } from '@/services';
import { formatAmount, logger } from '@/utils';

export default function RecurringPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Find current user's member UUID in the group
  const currentMemberId = useMemo(() => {
    if (!user?.id || members.length === 0) return '';
    const currentMember = members.find((m) => m.telegramId === user.id);
    return currentMember?.id || '';
  }, [user?.id, members]);

  useEffect(() => {
    if (!groupId || groupLoading) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [templatesData, groupData] = await Promise.all([
          api.getRecurringTemplates(groupId),
          api.getGroup(groupId),
        ]);

        setTemplates(templatesData);
        setMembers(groupData.members);
      } catch (err) {
        logger.error('Failed to load recurring templates', { groupId }, err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [groupId, groupLoading]);

  const handleDelete = async (templateId: string) => {
    if (!groupId || !confirm(t('recurring.confirmDelete'))) return;

    try {
      await api.deleteRecurringTemplate(groupId, templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      logger.error('Failed to delete template', { groupId, templateId }, err);
    }
  };

  const handleCreate = async (data: CreateRecurringInput) => {
    if (!groupId) return;
    try {
      const newTemplate = await api.createRecurringTemplate(groupId, data);
      setTemplates((prev) => [...prev, newTemplate]);
      setIsDialogOpen(false);
    } catch (err) {
      logger.error('Failed to create template', { groupId }, err);
    }
  };

  const getFrequencyLabel = (template: RecurringTemplate) => {
    switch (template.frequency) {
      case 'daily':
        return t('recurring.daily');
      case 'weekly': {
        const days = [
          t('recurring.sun'),
          t('recurring.mon'),
          t('recurring.tue'),
          t('recurring.wed'),
          t('recurring.thu'),
          t('recurring.fri'),
          t('recurring.sat'),
        ];

        return `${t('recurring.weekly')} (${days[template.dayOfWeek ?? 0]})`;
      }

      case 'monthly':
        return `${t('recurring.monthly')} (${template.dayOfMonth ?? 1}${t('recurring.dayOrdinal')})`;
      case 'yearly':
        return t('recurring.yearly');
      default:
        return template.frequency;
    }
  };

  if (groupLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  // USER VIEW: Show group picker when no group is selected
  if (!groupId) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 space-y-4 p-4 pb-4 motion-safe:duration-200">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t('recurring.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('userDashboard.selectGroupDescription')}</p>
        </div>

        {/* Group Picker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t('userDashboard.selectGroup')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {userGroups.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">{t('userDashboard.noGroups')}</p>
            ) : (
              userGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    void setGroupId(group.id);
                  }}
                  className="hover:bg-muted/50 bg-muted/20 flex w-full items-center gap-3 rounded-xl p-3 text-left active:scale-[0.98] motion-safe:transition-all motion-reduce:transition-none"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {group.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <TextTrimmer text={group.title} maxLength={20} className="font-semibold" />
                    <p className="text-muted-foreground text-xs">
                      {group.memberCount} {t('userDashboard.members')}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 space-y-4 p-4 pb-4 motion-safe:duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {userGroups.length > 1 && (
            <Button variant="ghost" size="sm" onClick={clearGroupSelection} className="text-muted-foreground -ml-2">
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('home.allGroups')}
            </Button>
          )}
          <h1 className="text-2xl font-bold">{t('recurring.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('recurring.subtitle')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('recurring.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('recurring.createTitle')}</DialogTitle>
            </DialogHeader>
            <CreateTemplateForm
              members={members}
              onSubmit={handleCreate}
              onCancel={() => {
                setIsDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <RefreshCw className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="font-medium">{t('recurring.noTemplates')}</p>
              <p className="text-muted-foreground text-sm">{t('recurring.noTemplatesDesc')}</p>
            </div>
            <Button
              onClick={() => {
                setIsDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('recurring.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <TextTrimmer text={template.name} maxLength={22} className="font-semibold" />
                    <p className="text-muted-foreground text-sm">{template.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    onClick={() => handleDelete(template.id)}
                    disabled={template.createdBy !== currentMemberId}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 rounded p-1">
                      <RefreshCw className="text-primary h-4 w-4" />
                    </div>
                    <span>{getFrequencyLabel(template)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-green-100 p-1 dark:bg-green-900">
                      <span className="text-green-600 dark:text-green-400">$</span>
                    </div>
                    <span className="font-medium">
                      {formatAmount(template.amount)} {template.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-blue-100 p-1 dark:bg-blue-900">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span>
                      {t('recurring.nextRun')}: {new Date(template.nextRun).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-purple-100 p-1 dark:bg-purple-900">
                      <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className={template.isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                      {template.isActive ? t('recurring.active') : t('recurring.inactive')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-muted-foreground text-xs">
                    {t('recurring.paidBy')}: <TextTrimmer text={template.payerName} maxLength={15} className="inline font-medium" />
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('recurring.splitWith')}: {template.splits.map((s) => s.userName).join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

interface CreateTemplateFormProps {
  members: User[];
  onSubmit: (data: CreateRecurringInput) => Promise<void>;
  onCancel: () => void;
}

function CreateTemplateForm({ members, onSubmit, onCancel }: CreateTemplateFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find current user's member UUID in the group
  const currentMemberId = useMemo(() => {
    if (!user?.id || members.length === 0) return '';
    const currentMember = members.find((m) => m.telegramId === user.id);
    return currentMember?.id || '';
  }, [user?.id, members]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !amount || selectedMembers.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        description,
        amount: parseFloat(amount),
        payerId: currentMemberId,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
        splits: selectedMembers.map((userId) => ({ userId })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('recurring.name')}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder={t('recurring.namePlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('recurring.description')}</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          placeholder={t('recurring.descriptionPlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">{t('recurring.amount')}</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
          }}
          placeholder="0.00"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t('recurring.frequency')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
            <Button
              key={freq}
              type="button"
              variant={frequency === freq ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFrequency(freq);
              }}
            >
              {t(`recurring.${freq}`)}
            </Button>
          ))}
        </div>
      </div>

      {frequency === 'weekly' && (
        <div className="space-y-2">
          <Label>{t('recurring.dayOfWeek')}</Label>
          <div className="grid grid-cols-7 gap-1">
            {[
              t('recurring.sun'),
              t('recurring.mon'),
              t('recurring.tue'),
              t('recurring.wed'),
              t('recurring.thu'),
              t('recurring.fri'),
              t('recurring.sat'),
            ].map((day, i) => (
              <Button
                key={i}
                type="button"
                variant={dayOfWeek === i ? 'default' : 'outline'}
                size="sm"
                className="px-2"
                onClick={() => {
                  setDayOfWeek(i);
                }}
              >
                {day}
              </Button>
            ))}
          </div>
        </div>
      )}

      {frequency === 'monthly' && (
        <div className="space-y-2">
          <Label htmlFor="dayOfMonth">{t('recurring.dayOfMonth')}</Label>
          <Input
            id="dayOfMonth"
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => {
              setDayOfMonth(parseInt(e.target.value));
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('recurring.splitWith')}</Label>
        <div className="space-y-2">
          {members.map((member) => (
            <label key={member.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMembers((prev) => [...prev, member.id]);
                  } else {
                    setSelectedMembers((prev) => prev.filter((id) => id !== member.id));
                  }
                }}
                className="rounded"
              />
              <span>{member.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? t('common.creating') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}
