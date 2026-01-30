import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExpensesPage from './expenses';
import { useToast } from '@/components/ui/use-toast';
import * as GroupProvider from '@/providers/GroupProvider';
import * as TelegramProvider from '@/providers/TelegramProvider';
import { api } from '@/services';

// Mock the providers and services
vi.mock('@/providers/TelegramProvider');
vi.mock('@/providers/GroupProvider');
vi.mock('@/services', () => ({
  api: {
    getGroup: vi.fn(),
    getExpenses: vi.fn(),
    getUserExpenses: vi.fn(),
    createExpense: vi.fn(),
    deleteExpense: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'toast.expenseDeleted.title': 'Expense deleted',
        'toast.expenseDeleted.description': 'Click undo to restore',
        'toast.expenseDeletedPermanently.title': 'Expense permanently deleted',
        'toast.deleteError.title': 'Failed to delete expense',
        'toast.undo': 'Undo',
        'expenses.title': 'Expenses',
        'expenses.search': 'Search expenses...',
        'expenses.tabs.all': 'All',
        'expenses.tabs.iPaid': 'I Paid',
        'expenses.tabs.iOwe': 'I Owe',
        'expenses.empty.title': 'No expenses yet',
        'expenses.empty.description': 'Add your first expense to get started',
      };

      return translations[key] || key;
    },
  }),
}));

describe('ExpensesPage - Undo Delete', () => {
  const mockExpense = {
    id: 'expense-1',
    description: 'Test Expense',
    amount: 100,
    currency: 'TON',
    payerId: 'user-1',
    payerName: 'Test User',
    splits: [{ userId: 'user-1', userName: 'Test User', amount: 100 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockToast = vi.fn();
  const mockDismiss = vi.fn();
  const mockHapticFeedback = {
    notificationOccurred: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers but allow promises to resolve
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 10 });

    // Mock useTelegram
    vi.mocked(TelegramProvider).useTelegram = vi.fn(() => ({
      user: { id: 123, first_name: 'Test', last_name: 'User' },
      hapticFeedback: mockHapticFeedback,
      webApp: {} as any,
    }));

    // Mock useGroup
    vi.mocked(GroupProvider).useGroup = vi.fn(() => ({
      groupId: 'group-1',
      isLoading: false,
      setGroupId: vi.fn(),
      clearGroupSelection: vi.fn(),
      userGroups: [{ id: 'group-1', title: 'Test Group', members: [] }],
    }));

    // Mock useToast
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast.mockReturnValue({ dismiss: mockDismiss }),
      toasts: [],
      dismiss: mockDismiss,
    });

    // Mock API
    vi.mocked(api.getGroup).mockResolvedValue({
      id: 'group-1',
      title: 'Test Group',
      members: [],
    } as any);

    vi.mocked(api.getExpenses).mockResolvedValue([mockExpense] as any);
    vi.mocked(api.deleteExpense).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show undo toast when expense is deleted', async () => {
    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Find and click the delete button
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify toast was called with undo action
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Expense deleted',
        description: 'Click undo to restore',
        variant: 'default',
        duration: 5000,
        action: expect.any(Object),
      }),
    );
  });

  it('should optimistically remove expense from UI when deleted', async () => {
    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Delete the expense
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify expense is removed from UI immediately
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
    });

    // Verify API was NOT called yet (deletion is delayed)
    expect(vi.mocked(api.deleteExpense)).not.toHaveBeenCalled();
  });

  it('should restore expense when undo is clicked', async () => {
    let undoCallback: () => void;

    // Capture the undo callback from the toast action
    mockToast.mockImplementation((options) => {
      if (options.action?.props?.onClick) {
        undoCallback = options.action.props.onClick;
      }

      return { dismiss: mockDismiss };
    });

    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Delete the expense
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify expense is removed
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
    });

    // Click undo
    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      undoCallback!();
    });

    // Verify expense is restored
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Verify haptic feedback was triggered
    expect(mockHapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');

    // Verify toast was dismissed
    expect(mockDismiss).toHaveBeenCalled();

    // Fast forward time and verify deletion doesn't happen
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(vi.mocked(api.deleteExpense)).not.toHaveBeenCalled();
  });

  it('should permanently delete after 5 seconds if undo not clicked', async () => {
    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Delete the expense
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify expense is removed from UI
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
    });

    // Fast forward time by 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Verify API was called to delete expense
    await waitFor(() => {
      expect(vi.mocked(api.deleteExpense)).toHaveBeenCalledWith('group-1', 'expense-1');
    });

    // Verify success haptic feedback
    expect(mockHapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');

    // Verify permanent deletion toast
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Expense permanently deleted',
        variant: 'success',
      }),
    );
  });

  it('should restore expense on API error', async () => {
    // Mock API to fail
    vi.mocked(api.deleteExpense).mockRejectedValue(new Error('Network error'));

    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Delete the expense
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify expense is removed from UI
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
    });

    // Fast forward time by 5 seconds (triggering the API call)
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Wait for error handling
    await waitFor(() => {
      expect(vi.mocked(api.deleteExpense)).toHaveBeenCalled();
    });

    // Verify expense is restored to UI
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Verify error haptic feedback
    expect(mockHapticFeedback.notificationOccurred).toHaveBeenCalledWith('error');

    // Verify error toast
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to delete expense',
        variant: 'destructive',
      }),
    );
  });

  it('should cleanup timeouts on component unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
    });

    // Delete the expense
    const deleteButton = screen.getByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Verify expense is removed
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
    });

    // Unmount the component before timeout completes
    unmount();

    // Verify clearTimeout was called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Fast forward time and verify API is NOT called (timeout was cleared)
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(vi.mocked(api.deleteExpense)).not.toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should handle multiple pending deletions correctly', async () => {
    // Add another expense
    const mockExpense2 = {
      ...mockExpense,
      id: 'expense-2',
      description: 'Test Expense 2',
      splits: [{ userId: 'user-1', userName: 'Test User', amount: 100 }],
    };

    vi.mocked(api.getExpenses).mockResolvedValue([mockExpense, mockExpense2] as any);

    render(<ExpensesPage />);

    // Allow async operations to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Test Expense')).toBeInTheDocument();
      expect(screen.getByText('Test Expense 2')).toBeInTheDocument();
    });

    // Delete both expenses
    const deleteButtons = screen.getAllByRole('button', { name: /delete expense/i });
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });

    await act(async () => {
      fireEvent.click(deleteButtons[1]);
    });

    // Verify both expenses are removed
    await waitFor(() => {
      expect(screen.queryByText('Test Expense')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Expense 2')).not.toBeInTheDocument();
    });

    // Fast forward time
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Verify both API calls were made
    await waitFor(() => {
      expect(vi.mocked(api.deleteExpense)).toHaveBeenCalledWith('group-1', 'expense-1');
      expect(vi.mocked(api.deleteExpense)).toHaveBeenCalledWith('group-1', 'expense-2');
    });
  });
});
