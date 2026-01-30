import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Mock lucide-react deep imports
vi.mock('lucide-react/dist/esm/icons/wallet', () => ({
  default: () => <div data-testid="wallet-icon" />,
}));

vi.mock('lucide-react/dist/esm/icons/log-out', () => ({
  default: () => <div data-testid="logout-icon" />,
}));

// Mock ClientOnly component - render children immediately in tests
vi.mock('@/components/ClientOnly', () => ({
  ClientOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Radix UI dropdown menu to render children directly
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Mock hooks
const mockToast = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockUseTonPayment = vi.fn();
const mockUseFormattedAddress = vi.fn();

vi.mock('@/hooks', () => ({
  useTonPayment: () => mockUseTonPayment(),
  useFormattedAddress: () => mockUseFormattedAddress(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('WalletButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default disconnected state
    mockUseTonPayment.mockReturnValue({
      isConnected: false,
      connect: mockConnect,
      disconnect: mockDisconnect,
    });

    mockUseFormattedAddress.mockReturnValue({
      full: 'EQD1234567890abcdef1234567890abcdef1234567890abcdef',
      short: 'EQD123...cdef',
    });
  });

  describe('Disconnected State', () => {
    it('should render Connect Wallet button when disconnected', async () => {
      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument();
    });

    it('should call connect when Connect Wallet button is clicked', async () => {
      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });
    });

    it('should show error toast when connection fails', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.walletConnectError.title',
          description: 'toast.walletConnectError.description',
          variant: 'destructive',
        });
      });
    });

    it('should show error toast when user rejects connection', async () => {
      mockConnect.mockRejectedValueOnce(new Error('User rejected'));

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.walletConnectError.title',
          description: 'toast.walletConnectError.description',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      mockUseTonPayment.mockReturnValue({
        isConnected: true,
        connect: mockConnect,
        disconnect: mockDisconnect,
      });

      mockUseFormattedAddress.mockReturnValue({
        full: 'EQD1234567890abcdef1234567890abcdef1234567890abcdef',
        short: 'EQD123...cdef',
      });
    });

    it('should render wallet address button when connected', async () => {
      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      expect(screen.getByText('EQD123...cdef')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument();
    });

    it('should render dropdown menu when button is clicked', async () => {
      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // In the mocked version, dropdown items are always rendered
      expect(screen.getByText('Copy Address')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('should show error toast when disconnect fails', async () => {
      mockDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click disconnect button (dropdown items are always visible in mocked version)
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.walletDisconnectError.title',
          description: 'toast.walletDisconnectError.description',
          variant: 'destructive',
        });
      });
    });

    it('should call disconnect when Disconnect button is clicked', async () => {
      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click disconnect button (dropdown items are always visible in mocked version)
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalled();
      });
    });

    it('should show success toast when address is copied successfully', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click copy address button (dropdown items are always visible in mocked version)
      const copyButton = screen.getByText('Copy Address');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'EQD1234567890abcdef1234567890abcdef1234567890abcdef',
        );

        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.addressCopied.title',
          description: 'toast.addressCopied.description',
          variant: 'success',
        });
      });
    });

    it('should show error toast when copying address fails', async () => {
      // Mock clipboard API to fail
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error('Clipboard access denied')),
        },
      });

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click copy address button (dropdown items are always visible in mocked version)
      const copyButton = screen.getByText('Copy Address');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.copyError.title',
          description: 'toast.copyError.description',
          variant: 'destructive',
        });
      });
    });

    it('should not attempt to copy when formattedAddress is null', async () => {
      mockUseFormattedAddress.mockReturnValue(null);

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click copy address button (dropdown items are always visible in mocked version)
      const copyButton = screen.getByText('Copy Address');
      fireEvent.click(copyButton);

      // Should not call clipboard.writeText when address is null
      // Wait a bit to ensure the handler had time to run
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle multiple connection errors gracefully', async () => {
      mockUseTonPayment.mockReturnValue({
        isConnected: false,
        connect: mockConnect,
        disconnect: mockDisconnect,
      });

      mockConnect.mockRejectedValue(new Error('Network error'));

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      const connectButton = screen.getByRole('button', { name: /connect wallet/i });

      // First attempt
      fireEvent.click(connectButton);
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
      });

      // Second attempt
      fireEvent.click(connectButton);
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(2);
      });

      // Verify button remains clickable
      expect(connectButton).toBeEnabled();
    });

    it('should handle disconnect errors without breaking UI', async () => {
      mockUseTonPayment.mockReturnValue({
        isConnected: true,
        connect: mockConnect,
        disconnect: mockDisconnect,
      });

      mockDisconnect.mockRejectedValue(new Error('Disconnect timeout'));

      const { WalletButton } = await import('./WalletButton');
      render(<WalletButton />);

      // Click disconnect button (dropdown items are always visible in mocked version)
      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'toast.walletDisconnectError.title',
          description: 'toast.walletDisconnectError.description',
          variant: 'destructive',
        });
      });

      // Buttons should still be rendered
      expect(screen.getByText('Copy Address')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });
});
