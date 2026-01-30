import { useCallback, useState } from 'react';
import { useTelegram } from '@/providers';
import { logger } from '@/utils';

interface ScanResult {
  data: string;
  timestamp: Date;
}

export function QRScanner() {
  const { isTelegram, showQRScanner, hapticFeedback } = useTelegram();
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async () => {
    if (!isTelegram) {
      setError('QR Scanner is only available in Telegram');

      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const result = await showQRScanner({
        text: 'Scan a QR code to add expense or join group',
      });

      if (result) {
        hapticFeedback.notificationOccurred('success');
        setScanHistory((prev) => [
          { data: result, timestamp: new Date() },
          ...prev.slice(0, 9), // Keep last 10 results
        ]);

        // Handle different QR code types
        handleScanResult(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsScanning(false);
    }
  }, [isTelegram, showQRScanner, hapticFeedback]);

  const handleScanResult = (data: string) => {
    // Try to parse as URL
    try {
      const url = new URL(data);

      // Check if it's a Fracti deep link
      if (url.hostname === 't.me' && url.pathname.includes('FractiBot')) {
        // Extract start parameter for deep linking
        const startParam = url.searchParams.get('start') || url.pathname.split('/').pop();
        logger.debug('Fracti deep link detected', { startParam });

        // Navigate to appropriate page based on deep link
        return;
      }

      // Check if it's a TON wallet address
      if (data.startsWith('ton://') || /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.exec(data)) {
        logger.debug('TON address detected', { address: data });

        // Handle TON address (e.g., for settlements)
        return;
      }
    } catch {
      // Not a URL, might be plain text or other format
    }

    // Try to parse as JSON (e.g., expense data)
    try {
      const parsed = JSON.parse(data);
      if (parsed.amount && parsed.description) {
        logger.debug('Expense data parsed', { parsed });

        // Handle expense creation
        return;
      }
    } catch {
      // Not JSON
    }

    logger.debug('Raw QR data', { data });
  };

  const clearHistory = () => {
    setScanHistory([]);
    hapticFeedback.impactOccurred('light');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      hapticFeedback.notificationOccurred('success');
    } catch {
      hapticFeedback.notificationOccurred('error');
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-bold">QR Scanner</h2>

      {/* Scanner Button */}
      <div className="flex flex-col items-center justify-center py-8">
        <button
          onClick={startScan}
          disabled={isScanning || !isTelegram}
          className={`flex h-32 w-32 items-center justify-center rounded-full motion-safe:transition-all motion-reduce:transition-none ${
            isScanning
              ? 'bg-primary/20 animate-pulse'
              : 'bg-primary hover:bg-primary/90 active:scale-95 motion-reduce:active:scale-100'
          }`}
        >
          <svg className="text-primary-foreground h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m10 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
        </button>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          {isScanning ? 'Scanning...' : 'Tap to scan QR code'}
        </p>

        {!isTelegram && <p className="mt-2 text-sm text-yellow-600">QR Scanner is only available in Telegram</p>}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg border p-3">
          <div className="bg-primary/10 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-lg">$</span>
          </div>
          <h3 className="text-sm font-medium">Add Expense</h3>
          <p className="text-muted-foreground text-xs">Scan expense QR to add quickly</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="bg-primary/10 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-lg">+</span>
          </div>
          <h3 className="text-sm font-medium">Join Group</h3>
          <p className="text-muted-foreground text-xs">Scan invite QR to join group</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="bg-primary/10 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-lg">*</span>
          </div>
          <h3 className="text-sm font-medium">TON Address</h3>
          <p className="text-muted-foreground text-xs">Scan wallet address for payment</p>
        </div>

        <div className="bg-card rounded-lg border p-3">
          <div className="bg-primary/10 mb-2 flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-lg">#</span>
          </div>
          <h3 className="text-sm font-medium">Receipt</h3>
          <p className="text-muted-foreground text-xs">Scan receipt QR for items</p>
        </div>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-semibold">Recent Scans</h3>
            <button onClick={clearHistory} className="text-muted-foreground hover:text-foreground text-sm">
              Clear
            </button>
          </div>

          <div className="divide-y">
            {scanHistory.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 p-3"
                onClick={() => copyToClipboard(result.data)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm">{result.data}</p>
                  <p className="text-muted-foreground text-xs">{result.timestamp.toLocaleTimeString()}</p>
                </div>
                <svg
                  className="text-muted-foreground h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
