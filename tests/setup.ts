import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.TABLE_NAME = 'test-table';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.AWS_REGION = 'us-east-1';
process.env.SKIP_TON_VERIFICATION = 'true';

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset modules before each test
beforeEach(() => {
  vi.resetModules();
});

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Telegram WebApp
const mockTelegramWebApp = {
  initData: 'mock_init_data',
  initDataUnsafe: {
    user: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      language_code: 'en',
    },
    chat_instance: 'test_chat_instance',
    chat_type: 'private',
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'mock_hash',
  },
  version: '7.0',
  platform: 'tdesktop',
  colorScheme: 'light',
  themeParams: {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    link_color: '#2481cc',
    button_color: '#5288c1',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f0f0f0',
  },
  isExpanded: true,
  viewportHeight: 600,
  viewportStableHeight: 600,
  headerColor: '#ffffff',
  backgroundColor: '#ffffff',
  isClosingConfirmationEnabled: false,
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  enableClosingConfirmation: vi.fn(),
  disableClosingConfirmation: vi.fn(),
  onEvent: vi.fn(),
  offEvent: vi.fn(),
  sendData: vi.fn(),
  openLink: vi.fn(),
  openTelegramLink: vi.fn(),
  showPopup: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
  MainButton: {
    text: '',
    color: '#5288c1',
    textColor: '#ffffff',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    setText: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
  },
  BackButton: {
    isVisible: false,
    onClick: vi.fn(),
    offClick: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  },
  HapticFeedback: {
    impactOccurred: vi.fn(),
    notificationOccurred: vi.fn(),
    selectionChanged: vi.fn(),
  },
  CloudStorage: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    getItems: vi.fn(),
    removeItem: vi.fn(),
    removeItems: vi.fn(),
    getKeys: vi.fn(),
  },
  setHeaderColor: vi.fn(),
  setBackgroundColor: vi.fn(),
};

Object.defineProperty(window, 'Telegram', {
  writable: true,
  value: {
    WebApp: mockTelegramWebApp,
  },
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${Math.random().toString(36).substring(7)}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }

      return arr;
    },
  },
});

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Helper to create mock DynamoDB responses
export function createMockDynamoDBResponse<T>(items: T[]) {
  return {
    Items: items,
    Count: items.length,
    ScannedCount: items.length,
    LastEvaluatedKey: undefined,
  };
}

// Helper to create mock expense records
export function createMockExpense(
  overrides: Partial<{
    id: string;
    groupId: string;
    payerId: string;
    payerName: string;
    amount: number;
    description: string;
    splits: { userId: string; userName: string; amount: number }[];
    createdAt: string;
  }> = {},
) {
  const now = new Date().toISOString();

  return {
    PK: `GROUP#${overrides.groupId ?? 'test-group'}`,
    SK: `TX#${overrides.createdAt ?? now}`,
    id: overrides.id ?? 'test-expense-id',
    groupId: overrides.groupId ?? 'test-group',
    payerId: overrides.payerId ?? 'user-1',
    payerName: overrides.payerName ?? 'Test User',
    amount: overrides.amount ?? 100,
    description: overrides.description ?? 'Test expense',
    splitType: 'equal' as const,
    splits: overrides.splits ?? [
      { userId: 'user-1', userName: 'Test User', amount: 50 },
      { userId: 'user-2', userName: 'Other User', amount: 50 },
    ],
    category: 'other',
    createdAt: overrides.createdAt ?? now,
    GSI2PK: `EXPENSE#${overrides.id ?? 'test-expense-id'}`,
    GSI2SK: overrides.groupId ?? 'test-group',
    GSI3PK: `USER#${overrides.payerId ?? 'user-1'}`,
    GSI3SK: `TX#${overrides.createdAt ?? now}`,
  };
}

// Helper to create mock settlement records
export function createMockSettlement(
  overrides: Partial<{
    id: string;
    groupId: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
  }> = {},
) {
  const now = new Date().toISOString();

  return {
    PK: `GROUP#${overrides.groupId ?? 'test-group'}`,
    SK: `SETTLE#${overrides.createdAt ?? now}`,
    id: overrides.id ?? 'test-settlement-id',
    groupId: overrides.groupId ?? 'test-group',
    fromUserId: overrides.fromUserId ?? 'user-2',
    fromUserName: overrides.fromUserName ?? 'Debtor User',
    toUserId: overrides.toUserId ?? 'user-1',
    toUserName: overrides.toUserName ?? 'Creditor User',
    amount: overrides.amount ?? 50,
    currency: 'TON',
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? now,
    GSI2PK: `SETTLEMENT#${overrides.id ?? 'test-settlement-id'}`,
    GSI2SK: overrides.groupId ?? 'test-group',
    GSI3PK: `USER#${overrides.fromUserId ?? 'user-2'}`,
    GSI3SK: `SETTLE#${overrides.createdAt ?? now}`,
  };
}

// Helper to create mock member records
export function createMockMember(
  overrides: Partial<{
    id: string;
    telegramId: number;
    name: string;
    username: string;
    wallet: string;
    groupId: string;
  }> = {},
) {
  return {
    PK: `GROUP#${overrides.groupId ?? 'test-group'}`,
    SK: `USER#${overrides.telegramId ?? 123456789}`,
    id: overrides.id ?? 'user-1',
    telegramId: overrides.telegramId ?? 123456789,
    name: overrides.name ?? 'Test User',
    username: overrides.username ?? 'testuser',
    wallet: overrides.wallet ?? 'EQTest...Wallet',
    avatarUrl: undefined,
    joinedAt: new Date().toISOString(),
    GSI1PK: `USER#${overrides.telegramId ?? 123456789}`,
    GSI1SK: `GROUP#${overrides.groupId ?? 'test-group'}`,
  };
}

// Helper to create mock group records
export function createMockGroup(
  overrides: Partial<{
    id: string;
    chatId: string;
    title: string;
    currency: string;
    memberCount: number;
  }> = {},
) {
  return {
    PK: `GROUP#${overrides.id ?? 'test-group'}`,
    SK: 'METADATA',
    id: overrides.id ?? 'test-group',
    chatId: overrides.chatId ?? '-1001234567890',
    title: overrides.title ?? 'Test Group',
    currency: overrides.currency ?? 'TON',
    createdAt: new Date().toISOString(),
    memberCount: overrides.memberCount ?? 2,
  };
}

// Export mock Telegram WebApp for use in tests
export { mockTelegramWebApp };
