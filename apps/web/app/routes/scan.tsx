import Camera from 'lucide-react/dist/esm/icons/camera';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Upload from 'lucide-react/dist/esm/icons/upload';
import X from 'lucide-react/dist/esm/icons/x';
import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { useAuth, useTelegram, useGroup } from '@/providers';
import { api, type ParsedReceipt } from '@/services';
import { formatAmount, formatCurrency, logger } from '@/utils';

export default function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hapticFeedback } = useTelegram();
  const { groupId, group, userGroups, setGroupId } = useGroup();
  const members = group?.members ?? [];
  const { toast } = useToast();

  // Find current user's member UUID in the group
  const currentMemberId = useMemo(() => {
    if (!user?.id || members.length === 0) return '';
    const currentMember = members.find((m) => m.telegramId === user.id);
    return currentMember?.id || '';
  }, [user?.id, members]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Get mime type from file
    const mimeType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg';

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const parts = dataUrl.split(',');
      // Ensure we have at least 2 parts (data URL format: "data:mime;base64,<data>")
      const base64 = parts.length > 1 ? parts[1] : null;
      if (!base64) {
        toast({
          title: t('toast.scanError.title'),
          description: t('toast.scanError.description'),
          variant: 'destructive',
        });

        return;
      }

      await processReceipt(base64, mimeType);
    };

    reader.onerror = () => {
      toast({
        title: t('toast.scanError.title'),
        description: t('toast.scanError.description'),
        variant: 'destructive',
      });

      setPreviewUrl(null);
    };

    reader.readAsDataURL(file);
  };

  const processReceipt = async (imageBase64: string, mimeType = 'image/jpeg') => {
    setIsProcessing(true);
    hapticFeedback.impactOccurred('medium');

    try {
      const result = await api.parseReceipt(imageBase64, mimeType);

      setReceipt(result);
      setSelectedItems(new Set(result.items.map((_, i) => i)));

      hapticFeedback.notificationOccurred('success');
      toast({
        title: t('toast.receiptScanned.title'),
        description: t('toast.receiptScanned.description', { count: result.items.length }),
        variant: 'success',
      });
    } catch (error) {
      logger.error('Failed to parse receipt', {}, error);
      hapticFeedback.notificationOccurred('error');
      toast({
        title: t('toast.scanError.title'),
        description: t('toast.scanError.description'),
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseText = async () => {
    if (!textInput.trim()) return;

    setIsParsing(true);
    hapticFeedback.impactOccurred('medium');

    try {
      const memberNames = members.map((m) => m.name);
      const result = await api.parseText(textInput, { members: memberNames, groupId: groupId ?? undefined });

      hapticFeedback.notificationOccurred('success');
      toast({
        title: t('toast.parseSuccess.title'),
        description: t('toast.parseSuccess.description', { description: result.description, amount: result.amount }),
        variant: 'success',
      });

      setTextInput('');

      // Navigate to add expense with pre-filled data
      void navigate('/expenses/add', {
        state: {
          amount: result.amount,
          description: result.description,
          payer: result.payer,
          beneficiaries: result.beneficiaries,
        },
      });
    } catch (error) {
      logger.error('Failed to parse text', {}, error);
      hapticFeedback.notificationOccurred('error');
      toast({
        title: t('toast.parseError.title'),
        description: t('toast.parseError.description'),
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const toggleItem = (index: number) => {
    hapticFeedback.selectionChanged();
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  const selectedTotal =
    receipt?.items.filter((_, i) => selectedItems.has(i)).reduce((sum, item) => sum + item.price, 0) ?? 0;

  const handleCreateExpense = async () => {
    if (!receipt || selectedItems.size === 0 || !groupId || !user) return;

    const selectedItemsList = receipt.items.filter((_, i) => selectedItems.has(i));
    const description =
      selectedItemsList.length === 1
        ? selectedItemsList[0].name
        : `${selectedItemsList.length} items from ${receipt.merchant ?? 'receipt'}`;

    hapticFeedback.impactOccurred('medium');

    try {
      // Create expense with equal split among all group members
      if (!currentMemberId) {
        logger.error('Current member not found in group', { groupId, userId: user?.id });
        toast({
          title: t('toast.error.title'),
          description: t('toast.error.memberNotFound'),
          variant: 'destructive',
        });
        return;
      }

      const splits = members.map((member) => ({
        userId: member.id,
        amount: selectedTotal / members.length,
      }));

      await api.createExpense(groupId, {
        payerId: currentMemberId,
        amount: selectedTotal,
        description,
        splitType: 'equal',
        splits,
      });

      hapticFeedback.notificationOccurred('success');
      toast({
        title: t('toast.expenseCreated.title'),
        description: t('toast.expenseCreated.description', {
          description,
          amount: formatAmount(selectedTotal),
        }),
        variant: 'success',
      });

      // Reset state and navigate to expenses
      setReceipt(null);
      setSelectedItems(new Set());
      setPreviewUrl(null);
      void navigate('/expenses');
    } catch (error) {
      logger.error('Failed to create expense', {}, error);
      hapticFeedback.notificationOccurred('error');
      toast({
        title: t('toast.expenseError.title'),
        description: t('toast.expenseError.description'),
        variant: 'destructive',
      });
    }
  };

  // USER VIEW: Show group picker when no group is selected
  if (!groupId) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 flex flex-col p-4 pb-4 motion-safe:duration-200">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">{t('scan.title')}</h1>
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
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 flex flex-col p-4 pb-4 motion-safe:duration-200">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t('scan.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('scan.description')}</p>
      </div>

      {!receipt ? (
        // Upload Section
        <div className="flex flex-1 flex-col items-center justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {previewUrl && isProcessing ? (
            <Card className="w-full max-w-sm overflow-hidden">
              <img src={previewUrl} alt={t('scan.analyzing')} className="h-64 w-full object-cover" />
              <CardContent className="flex flex-col items-center gap-2 py-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-primary h-5 w-5 animate-pulse" />
                  <span className="font-medium">{t('scan.analyzing')}</span>
                </div>
                <div className="bg-secondary h-2 w-48 overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-1/2 animate-[shimmer_1s_ease-in-out_infinite]" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="hover:border-primary hover:bg-primary/5 focus-within:ring-primary w-full max-w-sm cursor-pointer border-dashed focus-within:ring-2 motion-safe:transition-colors motion-reduce:transition-none"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={t('scan.uploadCta')}
            >
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="bg-primary/10 rounded-full p-4">
                  <Camera className="text-primary h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('scan.uploadCta')}</p>
                  <p className="text-muted-foreground text-sm">{t('scan.formats')}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Camera className="mr-2 h-4 w-4" />
                    {t('scan.camera')}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    {t('scan.gallery')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Message Input */}
          <div className="mt-8 w-full max-w-sm">
            <Label className="text-muted-foreground">{t('scan.orType')}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder={t('scan.typePlaceholder')}
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                }}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleParseText()}
                autoComplete="off"
                autoCorrect="on"
                enterKeyHint="send"
                aria-label={t('scan.orType')}
              />
              <Button variant="ton" onClick={handleParseText} disabled={isParsing || !textInput.trim()}>
                {isParsing ? (
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Results Section
        <div className="space-y-4">
          {/* Merchant Info */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{receipt.merchant}</CardTitle>
                <span className="text-muted-foreground text-sm">{receipt.date}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Sparkles className="text-primary h-4 w-4" />
                <span>{t('scan.receipt.confidence', { value: Math.round(receipt.confidence * 100) })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('scan.receipt.items')}</CardTitle>
                <span className="text-muted-foreground text-sm">
                  {t('scan.receipt.selected', { count: selectedItems.size })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <div className="divide-y">
                  {receipt.items.map((item, index) => {
                    const isSelected = selectedItems.has(index);

                    return (
                      <button
                        key={index}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`${item.name}, ${formatCurrency(item.price, receipt?.currency)}`}
                        onClick={() => {
                          toggleItem(index);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleItem(index);
                          }
                        }}
                        className={`focus:ring-primary flex w-full items-center justify-between p-4 text-left focus:ring-2 focus:ring-offset-2 focus:outline-none motion-safe:transition-colors motion-reduce:transition-none ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                            }`}
                          >
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-muted-foreground text-sm">
                              {t('scan.receipt.quantity', { count: item.quantity })}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium">{formatCurrency(item.price, receipt?.currency)}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('scan.receipt.subtotal')}</span>
                <span>{formatCurrency(selectedTotal, receipt?.currency)}</span>
              </div>
              {receipt.tax && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('scan.receipt.tax')}</span>
                  <span>{formatCurrency(receipt.tax, receipt.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>{t('scan.receipt.yourShare')}</span>
                <span className="text-primary">{formatCurrency(selectedTotal + (receipt.tax ?? 0), receipt?.currency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReceipt(null);
                setSelectedItems(new Set());
                setPreviewUrl(null);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              {t('scan.cancel')}
            </Button>
            <Button className="flex-1" disabled={selectedItems.size === 0} onClick={handleCreateExpense}>
              <Check className="mr-2 h-4 w-4" />
              {t('scan.createExpense')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
