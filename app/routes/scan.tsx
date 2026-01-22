import { useState, useRef } from 'react'
import { Camera, Upload, Sparkles, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/lib/telegram'
import { type ParsedReceipt } from '@/lib/api'
import { formatTON } from '@/lib/utils'
import { demoReceipt } from '@/lib/fixtures'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/use-toast'

export default function ScanPage() {
  const { t } = useTranslation()
  const { hapticFeedback } = useTelegram()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Convert to base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await processReceipt(base64)
    }
    reader.readAsDataURL(file)
  }

  const processReceipt = async (imageBase64: string) => {
    setIsProcessing(true)
    hapticFeedback.impactOccurred('medium')

    try {
      // In production: const result = await api.parseReceipt(imageBase64)
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setReceipt(demoReceipt)
      setSelectedItems(new Set(demoReceipt.items.map((_, i) => i)))

      hapticFeedback.notificationOccurred('success')
      toast({
        title: t('toast.receiptScanned.title'),
        description: t('toast.receiptScanned.description', { count: demoReceipt.items.length }),
        variant: 'success',
      })
    } catch (error) {
      hapticFeedback.notificationOccurred('error')
      toast({
        title: t('toast.scanError.title'),
        description: t('toast.scanError.description'),
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleParseText = async () => {
    if (!textInput.trim()) return

    setIsParsing(true)
    hapticFeedback.impactOccurred('medium')

    try {
      // In production: const result = await api.parseText(textInput)
      await new Promise((resolve) => setTimeout(resolve, 1500))

      hapticFeedback.notificationOccurred('success')
      toast({
        title: t('toast.parseSuccess.title'),
        description: t('toast.parseSuccess.description', { description: 'Dinner', amount: 50 }),
        variant: 'success',
      })
      setTextInput('')
    } catch (error) {
      hapticFeedback.notificationOccurred('error')
      toast({
        title: t('toast.parseError.title'),
        description: t('toast.parseError.description'),
        variant: 'destructive',
      })
    } finally {
      setIsParsing(false)
    }
  }

  const toggleItem = (index: number) => {
    hapticFeedback.selectionChanged()
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const selectedTotal = receipt?.items
    .filter((_, i) => selectedItems.has(i))
    .reduce((sum, item) => sum + item.price, 0) ?? 0

  const handleCreateExpense = () => {
    if (!receipt || selectedItems.size === 0) return

    const selectedItemsList = receipt.items.filter((_, i) => selectedItems.has(i))
    const description = selectedItemsList.length === 1
      ? selectedItemsList[0].name
      : `${selectedItemsList.length} items from ${receipt.merchant}`

    toast({
      title: t('toast.expenseCreated.title'),
      description: t('toast.expenseCreated.description', {
        description,
        amount: formatTON(selectedTotal)
      }),
      variant: 'success',
    })

    // Reset state
    setReceipt(null)
    setSelectedItems(new Set())
    setPreviewUrl(null)
  }

  return (
    <div className="flex flex-col p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t('scan.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('scan.description')}
        </p>
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
              <img
                src={previewUrl}
                alt="Receipt preview"
                className="h-64 w-full object-cover"
              />
              <CardContent className="flex flex-col items-center gap-2 py-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                  <span className="font-medium">{t('scan.analyzing')}</span>
                </div>
                <div className="h-2 w-48 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-1/2 animate-[shimmer_1s_ease-in-out_infinite] bg-primary" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="w-full max-w-sm cursor-pointer border-dashed transition-colors hover:border-primary hover:bg-primary/5"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="rounded-full bg-primary/10 p-4">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('scan.uploadCta')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('scan.formats')}
                  </p>
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
                onChange={(e) => setTextInput(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleParseText()}
              />
              <Button
                variant="ton"
                onClick={handleParseText}
                disabled={isParsing || !textInput.trim()}
              >
                {isParsing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
                <span className="text-sm text-muted-foreground">
                  {receipt.date}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{t('scan.receipt.confidence', { value: Math.round(receipt.confidence * 100) })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t('scan.receipt.items')}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {t('scan.receipt.selected', { count: selectedItems.size })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <div className="divide-y">
                  {receipt.items.map((item, index) => {
                    const isSelected = selectedItems.has(index)
                    return (
                      <button
                        key={index}
                        onClick={() => toggleItem(index)}
                        className={`flex w-full items-center justify-between p-4 text-left transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input'
                            }`}
                          >
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('scan.receipt.quantity', { count: item.quantity })}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium">
                          {formatTON(item.price)} TON
                        </span>
                      </button>
                    )
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
                <span>{formatTON(selectedTotal)} TON</span>
              </div>
              {receipt.tax && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('scan.receipt.tax')}</span>
                  <span>{formatTON(receipt.tax)} TON</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>{t('scan.receipt.yourShare')}</span>
                <span className="text-primary">
                  {formatTON(selectedTotal + (receipt.tax ?? 0))} TON
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReceipt(null)
                setSelectedItems(new Set())
                setPreviewUrl(null)
              }}
            >
              <X className="mr-2 h-4 w-4" />
              {t('scan.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={selectedItems.size === 0}
              onClick={handleCreateExpense}
            >
              <Check className="mr-2 h-4 w-4" />
              {t('scan.createExpense')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
