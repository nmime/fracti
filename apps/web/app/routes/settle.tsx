import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Coins from 'lucide-react/dist/esm/icons/coins';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { SettlementCard } from '@/components/SettlementCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { WalletButton } from '@/components/WalletButton';
import { useTonPayment, type JettonType } from '@/hooks';
import { useAuth, useTelegram, useGroup } from '@/providers';
import { type Settlement, type DebtNode, type UserSettlement, type SuggestedSettlement, api } from '@/services';
import { TextTrimmer } from '@/components/ui/text-trimmer';
import { formatAmount, formatCurrency, logger } from '@/utils';

type PaymentType = 'TON' | 'USDT';

// TON Crystal icon
const TonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/>
    <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5603 15.6277ZM26.2031 36.01L24.1558 32.0673L17.4583 20.0759C17.0571 19.3921 17.5493 18.5295 18.4386 18.5295H26.2031V36.01ZM38.5406 20.0759L31.8431 32.0673L29.7958 36.01V18.5295H37.5603C38.4496 18.5295 38.9418 19.3921 38.5406 20.0759Z" fill="white"/>
  </svg>
);

// USDT Tether icon
const UsdtIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#26A17B"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M29.8987 29.808V29.804C29.7787 29.816 29.1627 29.852 28.0147 29.852C27.1027 29.852 26.3507 29.82 26.0947 29.804V29.812C21.2787 29.596 17.6947 28.7 17.6947 27.64C17.6947 26.584 21.2787 25.688 26.0947 25.468V28.936C26.3547 28.956 27.1227 29 28.0347 29C29.1307 29 29.7747 28.948 29.8987 28.936V25.472C34.7027 25.692 38.2747 26.588 38.2747 27.64C38.2747 28.7 34.7027 29.592 29.8987 29.808ZM29.8987 25.168V22.088H36.6787V16.8H19.3347V22.088H26.0947V25.164C20.6307 25.42 16.5547 26.564 16.5547 27.94C16.5547 29.316 20.6307 30.456 26.0947 30.716V40.6H29.8987V30.712C35.3507 30.452 39.4147 29.312 39.4147 27.94C39.4147 26.568 35.3507 25.428 29.8987 25.168Z" fill="white"/>
  </svg>
);

const paymentOptions: { type: PaymentType; label: string; icon: typeof TonIcon }[] = [
  { type: 'TON', label: 'TON', icon: TonIcon },
  { type: 'USDT', label: 'USDT', icon: UsdtIcon },
];

export default function SettlePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { hapticFeedback } = useTelegram();
  const { groupId, isLoading: groupLoading, setGroupId, clearGroupSelection, userGroups } = useGroup();
  const { toast } = useToast();
  const { isConnected, sendTransaction, sendJettonTransaction } = useTonPayment();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [userSettlements, setUserSettlements] = useState<UserSettlement[]>([]);
  const [suggestedSettlements, setSuggestedSettlements] = useState<SuggestedSettlement[]>([]);
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  const [userBalance, setUserBalance] = useState(0);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType>('TON');
  // Member UUID for GROUP VIEW - obtained from debt graph node with name 'You'
  const [currentMemberId, setCurrentMemberId] = useState<string>('');

  // Telegram ID as string for USER VIEW comparisons (when showing settlements across all groups)
  // This is used for backward compatibility with existing settlement records
  const telegramUserId = user?.id ? String(user.id) : '';

  // Fetch settlements from API on mount
  useEffect(() => {
    if (groupLoading) return;

    const abortController = new AbortController();

    const loadData = async () => {
      setIsLoading(true);
      try {
        if (groupId) {
          // GROUP VIEW: Fetch group settlements and debts
          const [settlementsData, debtsData] = await Promise.all([api.getSettlements(groupId), api.getDebts(groupId)]);
          if (!abortController.signal.aborted) {
            setSettlements(settlementsData);
            // Store suggested settlements (who owes who based on expense calculations)
            setSuggestedSettlements(debtsData.suggestedSettlements || []);
            // Build wallet addresses map from debt nodes and find user balance/ID
            const wallets: Record<string, string> = {};
            let balance = 0;
            let memberId = '';
            debtsData.graph.nodes.forEach((node: DebtNode) => {
              if (node.wallet) {
                wallets[node.id] = node.wallet;
              }
              // Find current user's balance and member ID (node.name === 'You' marks current user)
              if (node.name === 'You') {
                balance = node.balance;
                memberId = node.id;
              }
            });

            setWalletAddresses(wallets);
            setUserBalance(balance);
            setCurrentMemberId(memberId);
          }
        } else {
          // USER VIEW: Fetch all user settlements
          const userSettlementsData = await api.getUserSettlements(50);
          if (!abortController.signal.aborted) {
            setUserSettlements(userSettlementsData);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        logger.error('Failed to load data', { groupId }, err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      abortController.abort();
    };
  }, [groupId, groupLoading]);

  // Memoize settlement calculations to avoid recalculation on every render
  const { pendingSettlements, completedSettlements, userDebts, userCredits, totalOwed, totalToReceive } = useMemo(() => {
    const pending = settlements.filter((s) => s.status === 'pending');
    const completed = settlements.filter((s) => s.status === 'completed');

    // Filter suggested settlements to find what current user owes and is owed
    // These are calculated debts from expenses, not yet converted to settlement records
    const debts = suggestedSettlements.filter((s) => s.fromUserId === currentMemberId);
    const credits = suggestedSettlements.filter((s) => s.toUserId === currentMemberId);

    // Calculate owed/receive from debt graph balance (consistent with Home page)
    // Negative balance = user owes money, Positive balance = user is owed money
    const owed = userBalance < 0 ? Math.abs(userBalance) : 0;
    const toReceive = userBalance > 0 ? userBalance : 0;

    return {
      pendingSettlements: pending,
      completedSettlements: completed,
      userDebts: debts,
      userCredits: credits,
      totalOwed: owed,
      totalToReceive: toReceive,
    };
  }, [settlements, suggestedSettlements, userBalance, currentMemberId]);

  // Show loading state while group is loading
  if (groupLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
      </div>
    );
  }

  // USER VIEW: Show all settlements across groups
  if (!groupId) {
    // Group settlements by group
    const settlementsByGroup = userSettlements.reduce<
      Record<string, { groupId: string; groupTitle: string; settlements: UserSettlement[] }>
    >((acc, settlement) => {
      if (!acc[settlement.groupId]) {
        acc[settlement.groupId] = {
          groupId: settlement.groupId,
          groupTitle: settlement.groupTitle,
          settlements: [],
        };
      }

      acc[settlement.groupId].settlements.push(settlement);

      return acc;
    }, {});

    const groupedSettlements = Object.values(settlementsByGroup);

    // Calculate total owed and to receive from GROUP BALANCES (consistent with Home page)
    const userTotalOwed = userGroups.reduce((sum, g) => (g.balance < 0 ? sum + Math.abs(g.balance) : sum), 0);
    const userTotalToReceive = userGroups.reduce((sum, g) => (g.balance > 0 ? sum + g.balance : sum), 0);

    // Get groups where user owes money (balance < 0) or is owed money (balance > 0)
    const groupsWithDebts = userGroups.filter((g) => g.balance < 0);
    const groupsWithCredits = userGroups.filter((g) => g.balance > 0);
    const hasAnyDebtsOrCredits = groupsWithDebts.length > 0 || groupsWithCredits.length > 0;

    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 flex flex-col motion-safe:duration-200">
        {/* Header */}
        <div className="bg-background sticky top-0 z-30 space-y-4 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('userDashboard.allSettlements')}</h1>
            <WalletButton />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-destructive/20 bg-destructive/10">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">{t('settle.youOwe')}</p>
                <p className="text-destructive text-xl font-bold">{formatCurrency(userTotalOwed)}</p>
              </CardContent>
            </Card>
            <Card className="border-success/20 bg-success/10">
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">{t('settle.youllReceive')}</p>
                <p className="text-success text-xl font-bold">{formatCurrency(userTotalToReceive)}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Settlements by Group */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-4 pb-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
              </div>
            ) : !hasAnyDebtsOrCredits && groupedSettlements.length === 0 ? (
              <Card className="border-success/20 bg-success/10">
                <CardContent className="flex flex-col items-center gap-2 py-8">
                  <CheckCircle className="text-success h-12 w-12" />
                  <p className="text-success font-medium">{t('settle.allSettled.title')}</p>
                  <p className="text-muted-foreground text-sm">{t('settle.allSettled.description')}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Groups where user owes money */}
                {groupsWithDebts.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-muted-foreground text-sm font-medium">
                      {t('settle.debtsToPay', { count: groupsWithDebts.length })}
                    </h2>
                    {groupsWithDebts.map((group) => (
                      <Card key={group.id} className="bg-yellow-50 dark:bg-yellow-950 overflow-hidden">
                        <CardContent className="p-4">
                          <button
                            onClick={() => {
                              void setGroupId(group.id);
                            }}
                            className="flex w-full items-center justify-between"
                          >
                            <div className="text-left">
                              <TextTrimmer text={group.title} maxLength={24} className="font-medium" />
                              <p className="text-muted-foreground text-xs">{t('settle.youOwe')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-destructive font-semibold">
                                {formatCurrency(Math.abs(group.balance))}
                              </span>
                              <ChevronRight className="text-muted-foreground h-4 w-4" />
                            </div>
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Groups where user is owed money */}
                {groupsWithCredits.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-muted-foreground text-sm font-medium">
                      {t('settle.owedToYou', { count: groupsWithCredits.length })}
                    </h2>
                    {groupsWithCredits.map((group) => (
                      <Card key={group.id} className="bg-green-50 dark:bg-green-950 overflow-hidden">
                        <CardContent className="p-4">
                          <button
                            onClick={() => {
                              void setGroupId(group.id);
                            }}
                            className="flex w-full items-center justify-between"
                          >
                            <div className="text-left">
                              <TextTrimmer text={group.title} maxLength={24} className="font-medium" />
                              <p className="text-muted-foreground text-xs">{t('settle.owesYou')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-success font-semibold">
                                {formatCurrency(group.balance)}
                              </span>
                              <ChevronRight className="text-muted-foreground h-4 w-4" />
                            </div>
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Existing settlement records by group */}
                {groupedSettlements.map((group) => {
                  const pendingCount = group.settlements.filter((s) => s.status === 'pending').length;

                  return (
                    <div key={group.groupId} className="space-y-3">
                      <button
                        onClick={() => {
                          void setGroupId(group.groupId);
                        }}
                        className="hover:bg-muted/50 -ml-2 flex w-full items-center justify-between rounded-lg p-2 text-left motion-safe:transition-colors motion-reduce:transition-none"
                      >
                        <div>
                          <h2 className="text-muted-foreground text-sm font-semibold">{group.groupTitle}</h2>
                          {pendingCount > 0 && (
                            <p className="text-warning text-xs">{t('settle.pending', { count: pendingCount })}</p>
                          )}
                        </div>
                        <ChevronRight className="text-muted-foreground h-4 w-4" />
                      </button>
                      {group.settlements
                        .filter((s) => s.status === 'pending')
                        .slice(0, 3)
                        .map((settlement) => {
                          // In USER VIEW, settlements are returned for the current user
                          // The backend queries by telegramId and uses member UUIDs in records
                          // Check if user is the payer (fromUserId matches telegramId for legacy or name matches for new)
                          const isCurrentUserPayer = settlement.fromUserId === telegramUserId || settlement.fromUserName === user?.firstName;
                          return (
                            <Card key={settlement.id}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <TextTrimmer
                                      text={isCurrentUserPayer ? settlement.toUserName : settlement.fromUserName}
                                      maxLength={18}
                                      className="font-medium"
                                    />
                                    <p className="text-muted-foreground text-xs">
                                      {isCurrentUserPayer ? t('settle.youOwe') : t('settle.owesYou')}
                                    </p>
                                  </div>
                                  <span
                                    className={`font-medium ${isCurrentUserPayer ? 'text-destructive' : 'text-success'}`}
                                  >
                                    {formatAmount(settlement.amount)} {settlement.currency}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {group.settlements.filter((s) => s.status === 'pending').length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            void setGroupId(group.groupId);
                          }}
                        >
                          {t('home.viewAll')} ({group.settlements.filter((s) => s.status === 'pending').length})
                        </Button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>
        <ScrollToTopButton />
      </div>
    );
  }

  const handlePay = async (settlement: Settlement) => {
    if (!isConnected) {
      toast({
        title: t('toast.walletNotConnected.title'),
        description: t('toast.walletNotConnected.description'),
        variant: 'destructive',
      });

      return;
    }

    const recipientWallet = walletAddresses[settlement.toUserId];
    if (!recipientWallet) {
      toast({
        title: t('toast.noWalletAddress.title'),
        description: t('toast.noWalletAddress.description', { name: settlement.toUserName }),
        variant: 'destructive',
      });

      return;
    }

    setPayingId(settlement.id);
    hapticFeedback.impactOccurred('medium');

    try {
      let boc: string;

      if (selectedPaymentType === 'TON') {
        // Standard TON transfer
        boc = await sendTransaction({
          to: recipientWallet,
          amount: settlement.amount,
          comment: `Fracti Settlement #${settlement.id}`,
        });
      } else {
        // Jetton (USDT/USDC) transfer
        boc = await sendJettonTransaction({
          to: recipientWallet,
          amount: settlement.amount,
          jettonType: selectedPaymentType as JettonType,
          comment: `Fracti Settlement #${settlement.id}`,
        });
      }

      // Confirm settlement with the API
      try {
        await api.confirmSettlement(groupId, settlement.id, boc);
      } catch (apiErr) {
        logger.warn('Failed to confirm settlement with API, updating locally', { settlementId: settlement.id }, apiErr);
      }

      // Update local settlement status
      setSettlements((prev) =>
        prev.map((s) => (s.id === settlement.id ? { ...s, status: 'completed', txHash: boc } : s)),
      );

      hapticFeedback.notificationOccurred('success');
      toast({
        title: t('toast.paymentSent.title'),
        description: t('toast.paymentSent.description', {
          amount: formatAmount(settlement.amount),
          name: settlement.toUserName,
        }),
        variant: 'success',
      });
    } catch (error) {
      logger.error('Payment failed', { settlementId: settlement.id, paymentType: selectedPaymentType }, error);
      hapticFeedback.notificationOccurred('error');
      toast({
        title: t('toast.paymentError.title'),
        description: t('toast.paymentError.description', {
          error: error instanceof Error ? error.message : 'Please try again',
        }),
        variant: 'destructive',
      });
    } finally {
      setPayingId(null);
    }
  };

  // Handle paying a debt (suggested settlement - calculated from expenses)
  const handlePayDebt = async (debt: SuggestedSettlement) => {
    if (!isConnected) {
      toast({
        title: t('toast.walletNotConnected.title'),
        description: t('toast.walletNotConnected.description'),
        variant: 'destructive',
      });

      return;
    }

    const recipientWallet = walletAddresses[debt.toUserId];
    if (!recipientWallet) {
      toast({
        title: t('toast.noWalletAddress.title'),
        description: t('toast.noWalletAddress.description', { name: debt.toUserName }),
        variant: 'destructive',
      });

      return;
    }

    // Use a unique ID for the debt (combination of from/to user IDs)
    const debtId = `debt-${debt.fromUserId}-${debt.toUserId}`;
    setPayingId(debtId);
    hapticFeedback.impactOccurred('medium');

    try {
      let boc: string;

      if (selectedPaymentType === 'TON') {
        // Standard TON transfer
        boc = await sendTransaction({
          to: recipientWallet,
          amount: debt.amount,
          comment: `Fracti Payment to ${debt.toUserName}`,
        });
      } else {
        // Jetton (USDT/USDC) transfer
        boc = await sendJettonTransaction({
          to: recipientWallet,
          amount: debt.amount,
          jettonType: selectedPaymentType as JettonType,
          comment: `Fracti Payment to ${debt.toUserName}`,
        });
      }

      // Create settlement record with the transaction hash
      try {
        const newSettlement = await api.recordSettlement(groupId, {
          toId: debt.toUserId,
          amount: debt.amount,
          txHash: boc,
          recipientWallet,
          paymentType: selectedPaymentType,
        });

        // Add to local settlements and remove from suggested
        setSettlements((prev) => [...prev, { ...newSettlement, status: 'completed' }]);
        setSuggestedSettlements((prev) =>
          prev.filter((s) => !(s.fromUserId === debt.fromUserId && s.toUserId === debt.toUserId)),
        );
      } catch (apiErr) {
        logger.warn('Failed to record settlement with API', { debt }, apiErr);
      }

      hapticFeedback.notificationOccurred('success');
      toast({
        title: t('toast.paymentSent.title'),
        description: t('toast.paymentSent.description', {
          amount: formatAmount(debt.amount),
          name: debt.toUserName,
        }),
        variant: 'success',
      });
    } catch (error) {
      logger.error('Debt payment failed', { debt, paymentType: selectedPaymentType }, error);
      hapticFeedback.notificationOccurred('error');
      toast({
        title: t('toast.paymentError.title'),
        description: t('toast.paymentError.description', {
          error: error instanceof Error ? error.message : 'Please try again',
        }),
        variant: 'destructive',
      });
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 flex flex-col motion-safe:duration-200">
      {/* Header */}
      <div className="bg-background sticky top-0 z-30 space-y-4 border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            {userGroups.length > 1 && (
              <Button variant="ghost" size="sm" onClick={clearGroupSelection} className="text-muted-foreground -ml-2">
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('home.allGroups')}
              </Button>
            )}
            <h1 className="text-xl font-bold">{t('settle.title')}</h1>
          </div>
          <WalletButton />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-destructive/20 bg-destructive/10">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t('settle.youOwe')}</p>
              <p className="text-destructive text-xl font-bold">{formatCurrency(totalOwed)}</p>
            </CardContent>
          </Card>
          <Card className="border-success/20 bg-success/10">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t('settle.youllReceive')}</p>
              <p className="text-success text-xl font-bold">{formatCurrency(totalToReceive)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Type Selection */}
        {isConnected && (pendingSettlements.length > 0 || userDebts.length > 0) && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Coins className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-sm">{t('settle.payWith')}:</span>
                <div className="flex flex-1 gap-2">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.type}
                        variant={selectedPaymentType === option.type ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedPaymentType(option.type);
                          hapticFeedback.selectionChanged();
                        }}
                      >
                        <Icon className="mr-1.5 h-4 w-4" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isConnected && (
          <Card className="border-warning/20 bg-warning/10">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="text-warning h-5 w-5" />
              <div className="flex-1">
                <p className="text-warning text-sm font-medium">{t('settle.connectWallet')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Settlements List */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4 pb-4">
          {/* Loading State - also wait for currentMemberId to prevent flicker */}
          {isLoading || (groupId && !currentMemberId) ? (
            <div className="flex h-40 items-center justify-center">
              <div className="border-primary h-8 w-8 rounded-full border-4 border-t-transparent motion-safe:animate-spin motion-reduce:opacity-50" />
            </div>
          ) : (
            <>
              {/* Debts to Pay - from expense calculations */}
              {userDebts.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-muted-foreground text-sm font-medium">
                    {t('settle.debtsToPay', { count: userDebts.length })}
                  </h2>
                  {userDebts.map((debt) => {
                    const debtId = `debt-${debt.fromUserId}-${debt.toUserId}`;
                    return (
                      <Card key={debtId} className="bg-yellow-50 dark:bg-yellow-950 overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <TextTrimmer text={debt.toUserName} maxLength={18} className="font-medium" />
                              </div>
                              <p className="text-muted-foreground text-xs">{t('settle.youOwe')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-destructive font-semibold">
                                {formatCurrency(debt.amount)}
                              </span>
                              {isConnected && walletAddresses[debt.toUserId] && (
                                <Button
                                  variant="ton"
                                  size="sm"
                                  onClick={() => {
                                    void handlePayDebt(debt);
                                  }}
                                  disabled={payingId === debtId}
                                >
                                  {payingId === debtId ? t('settle.paying') : `${t('settle.pay')} ${selectedPaymentType}`}
                                </Button>
                              )}
                              {isConnected && !walletAddresses[debt.toUserId] && (
                                <span className="text-muted-foreground text-xs">{t('settle.noWallet')}</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Credits - money owed to you */}
              {userCredits.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-muted-foreground text-sm font-medium">
                    {t('settle.owedToYou', { count: userCredits.length })}
                  </h2>
                  {userCredits.map((credit) => {
                    const creditId = `credit-${credit.fromUserId}-${credit.toUserId}`;
                    return (
                      <Card key={creditId} className="bg-green-50 dark:bg-green-950 overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <TextTrimmer text={credit.fromUserName} maxLength={18} className="font-medium" />
                              </div>
                              <p className="text-muted-foreground text-xs">{t('settle.owesYou')}</p>
                            </div>
                            <span className="text-success font-semibold">
                              {formatCurrency(credit.amount)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Pending Settlements */}
              {pendingSettlements.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-muted-foreground text-sm font-medium">
                    {t('settle.pending', { count: pendingSettlements.length })}
                  </h2>
                  {pendingSettlements.map((settlement) => (
                    <SettlementCard
                      key={settlement.id}
                      settlement={settlement}
                      currentMemberId={currentMemberId}
                      onPay={handlePay}
                      isLoading={payingId === settlement.id}
                      paymentType={selectedPaymentType}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {!isLoading && currentMemberId && pendingSettlements.length === 0 && userDebts.length === 0 && userCredits.length === 0 && (
            <Card className="border-success/20 bg-success/10">
              <CardContent className="flex flex-col items-center gap-2 py-8">
                <CheckCircle className="text-success h-12 w-12" />
                <p className="text-success font-medium">{t('settle.allSettled.title')}</p>
                <p className="text-muted-foreground text-sm">{t('settle.allSettled.description')}</p>
              </CardContent>
            </Card>
          )}

          {/* Completed Settlements */}
          {!isLoading && currentMemberId && completedSettlements.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <h2 className="text-muted-foreground text-sm font-medium">
                {t('settle.completed', { count: completedSettlements.length })}
              </h2>
              {completedSettlements.map((settlement) => (
                <SettlementCard key={settlement.id} settlement={settlement} currentMemberId={currentMemberId} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      <ScrollToTopButton />
    </div>
  );
}
