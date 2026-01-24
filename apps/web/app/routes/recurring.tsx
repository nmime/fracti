import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Plus, Trash2, Calendar, Clock, Users } from 'lucide-react'
import { useTelegram } from '@/lib/telegram'
import { useGroup } from '@/lib/group-context'
import { api, type RecurringTemplate, type CreateRecurringInput, type User } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function RecurringPage() {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const { groupId, isLoading: groupLoading } = useGroup()
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (!groupId || groupLoading) return

    const loadData = async () => {
      setIsLoading(true)
      try {
        const [templatesData, groupData] = await Promise.all([
          api.getRecurringTemplates(groupId),
          api.getGroup(groupId),
        ])
        setTemplates(templatesData)
        setMembers(groupData.members)
      } catch (err) {
        logger.error('Failed to load recurring templates', { groupId }, err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [groupId, groupLoading])

  const handleDelete = async (templateId: string) => {
    if (!groupId || !confirm(t('recurring.confirmDelete'))) return

    try {
      await api.deleteRecurringTemplate(groupId, templateId)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    } catch (err) {
      logger.error('Failed to delete template', { groupId, templateId }, err)
    }
  }

  const handleCreate = async (data: CreateRecurringInput) => {
    if (!groupId) return
    try {
      const newTemplate = await api.createRecurringTemplate(groupId, data)
      setTemplates((prev) => [...prev, newTemplate])
      setIsDialogOpen(false)
    } catch (err) {
      logger.error('Failed to create template', { groupId }, err)
    }
  }

  const getFrequencyLabel = (template: RecurringTemplate) => {
    switch (template.frequency) {
      case 'daily':
        return t('recurring.daily')
      case 'weekly':
        const days = [t('recurring.sun'), t('recurring.mon'), t('recurring.tue'), t('recurring.wed'), t('recurring.thu'), t('recurring.fri'), t('recurring.sat')]
        return `${t('recurring.weekly')} (${days[template.dayOfWeek ?? 0]})`
      case 'monthly':
        return `${t('recurring.monthly')} (${template.dayOfMonth ?? 1}${t('recurring.dayOrdinal')})`
      case 'yearly':
        return t('recurring.yearly')
      default:
        return template.frequency
    }
  }

  if (groupLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!groupId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t('recurring.noGroup.title')}</h2>
        <p className="text-muted-foreground">{t('recurring.noGroup.description')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('recurring.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('recurring.subtitle')}</p>
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
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
            <RefreshCw className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">{t('recurring.noTemplates')}</p>
              <p className="text-sm text-muted-foreground">{t('recurring.noTemplatesDesc')}</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
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
                  <div className="space-y-1">
                    <h3 className="font-semibold">{template.name}</h3>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDelete(template.id)}
                    disabled={template.createdBy !== String(user?.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-primary/10 p-1">
                      <RefreshCw className="h-4 w-4 text-primary" />
                    </div>
                    <span>{getFrequencyLabel(template)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-green-100 p-1">
                      <span className="text-green-600">$</span>
                    </div>
                    <span className="font-medium">
                      {formatTON(template.amount)} {template.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-blue-100 p-1">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <span>
                      {t('recurring.nextRun')}: {new Date(template.nextRun).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-purple-100 p-1">
                      <Clock className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className={template.isActive ? 'text-green-600' : 'text-muted-foreground'}>
                      {template.isActive ? t('recurring.active') : t('recurring.inactive')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {t('recurring.paidBy')}: <span className="font-medium">{template.payerName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('recurring.splitWith')}: {template.splits.map((s) => s.userName).join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface CreateTemplateFormProps {
  members: User[]
  onSubmit: (data: CreateRecurringInput) => void
  onCancel: () => void
}

function CreateTemplateForm({ members, onSubmit, onCancel }: CreateTemplateFormProps) {
  const { t } = useTranslation()
  const { user } = useTelegram()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentUserId = String(user?.id ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !description || !amount || selectedMembers.length === 0) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        name,
        description,
        amount: parseFloat(amount),
        payerId: currentUserId,
        frequency,
        dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
        splits: selectedMembers.map((userId) => ({ userId })),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t('recurring.name')}</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('recurring.namePlaceholder')}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t('recurring.description')}</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          onChange={(e) => setAmount(e.target.value)}
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
              onClick={() => setFrequency(freq)}
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
            {[t('recurring.sun'), t('recurring.mon'), t('recurring.tue'), t('recurring.wed'), t('recurring.thu'), t('recurring.fri'), t('recurring.sat')].map((day, i) => (
              <Button
                key={i}
                type="button"
                variant={dayOfWeek === i ? 'default' : 'outline'}
                size="sm"
                className="px-2"
                onClick={() => setDayOfWeek(i)}
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
            onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('recurring.splitWith')}</Label>
        <div className="space-y-2">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMembers((prev) => [...prev, member.id])
                  } else {
                    setSelectedMembers((prev) => prev.filter((id) => id !== member.id))
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
  )
}
