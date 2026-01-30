import type { Page } from '@playwright/test';

/**
 * Mock Telegram WebApp for E2E testing
 */
export interface MockTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface MockTelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
}

export interface MockTelegramWebAppOptions {
  user?: Partial<MockTelegramUser>;
  chat?: Partial<MockTelegramChat>;
  colorScheme?: 'light' | 'dark';
  isExpanded?: boolean;
}

export const defaultUser: MockTelegramUser = {
  id: 123456789,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'en',
  is_premium: false,
};

export const defaultChat: MockTelegramChat = {
  id: -987654321,
  type: 'group',
  title: 'Test Group',
};

export function createMockTelegramWebApp(options: MockTelegramWebAppOptions = {}) {
  const user = { ...defaultUser, ...options.user };
  const chat = { ...defaultChat, ...options.chat };
  const colorScheme = options.colorScheme || 'dark';
  const isExpanded = options.isExpanded ?? true;

  return {
    initData: `user=${encodeURIComponent(JSON.stringify(user))}&chat=${encodeURIComponent(JSON.stringify(chat))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=test_hash`,
    initDataUnsafe: {
      user,
      chat,
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'test_hash',
    },
    version: '7.10',
    platform: 'web',
    colorScheme,
    themeParams: {
      bg_color: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
      text_color: colorScheme === 'dark' ? '#ffffff' : '#000000',
      hint_color: colorScheme === 'dark' ? '#8e8e93' : '#999999',
      link_color: '#007aff',
      button_color: '#007aff',
      button_text_color: '#ffffff',
      secondary_bg_color: colorScheme === 'dark' ? '#2c2c2e' : '#efeff4',
    },
    isExpanded,
    viewportHeight: 600,
    viewportStableHeight: 600,
    headerColor: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
    backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#ffffff',
    isClosingConfirmationEnabled: false,
    ready: () => {},
    expand: () => {},
    close: () => {},
    enableClosingConfirmation: () => {},
    disableClosingConfirmation: () => {},
    setHeaderColor: () => {},
    setBackgroundColor: () => {},
    onEvent: () => {},
    offEvent: () => {},
    sendData: () => {},
    switchInlineQuery: () => {},
    openLink: () => {},
    openTelegramLink: () => {},
    openInvoice: () => {},
    showPopup: () => Promise.resolve('ok'),
    showAlert: () => Promise.resolve(),
    showConfirm: () => Promise.resolve(true),
    showScanQrPopup: () => {},
    closeScanQrPopup: () => {},
    readTextFromClipboard: () => Promise.resolve(''),
    requestWriteAccess: () => Promise.resolve(true),
    requestContact: () => Promise.resolve(null),
    MainButton: {
      text: '',
      color: '#007aff',
      textColor: '#ffffff',
      isVisible: false,
      isActive: true,
      isProgressVisible: false,
      show: () => {},
      hide: () => {},
      enable: () => {},
      disable: () => {},
      showProgress: () => {},
      hideProgress: () => {},
      setText: (text: string) => {},
      setParams: () => {},
      onClick: () => {},
      offClick: () => {},
    },
    BackButton: {
      isVisible: false,
      show: () => {},
      hide: () => {},
      onClick: () => {},
      offClick: () => {},
    },
    SettingsButton: {
      isVisible: false,
      show: () => {},
      hide: () => {},
      onClick: () => {},
      offClick: () => {},
    },
    HapticFeedback: {
      impactOccurred: (style: string) => {},
      notificationOccurred: (type: string) => {},
      selectionChanged: () => {},
    },
    CloudStorage: {
      setItem: () => Promise.resolve(true),
      getItem: () => Promise.resolve(''),
      getItems: () => Promise.resolve({}),
      removeItem: () => Promise.resolve(true),
      removeItems: () => Promise.resolve(true),
      getKeys: () => Promise.resolve([]),
    },
    BiometricManager: {
      isInited: false,
      isBiometricAvailable: false,
      biometricType: 'unknown',
      isAccessRequested: false,
      isAccessGranted: false,
      isBiometricTokenSaved: false,
      deviceId: '',
      init: () => Promise.resolve(),
      requestAccess: () => Promise.resolve(false),
      authenticate: () => Promise.resolve(false),
      updateBiometricToken: () => Promise.resolve(false),
      openSettings: () => {},
    },
  };
}

/**
 * Inject Telegram WebApp mock into page
 */
export async function injectTelegramMock(page: Page, options?: MockTelegramWebAppOptions) {
  const mockWebApp = createMockTelegramWebApp(options);

  await page.addInitScript((webApp) => {
    (window as unknown as { Telegram: { WebApp: typeof webApp } }).Telegram = { WebApp: webApp };
  }, mockWebApp);
}

/**
 * Create mock API responses
 */
export const mockApiResponses = {
  groups: [
    {
      id: 'group-1',
      chatId: '-987654321',
      title: 'Test Group',
      currency: 'USD',
      memberCount: 3,
      createdAt: new Date().toISOString(),
    },
  ],
  members: [
    { id: '123456789', name: 'Test User', username: 'testuser', avatarUrl: null },
    { id: '111111111', name: 'Alice', username: 'alice', avatarUrl: null },
    { id: '222222222', name: 'Bob', username: 'bob', avatarUrl: null },
  ],
  expenses: [
    {
      id: 'expense-1',
      groupId: 'group-1',
      payerId: '123456789',
      payerName: 'Test User',
      amount: 100,
      currency: 'USD',
      description: 'Dinner',
      splitType: 'equal',
      splits: [
        { userId: '123456789', userName: 'Test User', amount: 33.33 },
        { userId: '111111111', userName: 'Alice', amount: 33.33 },
        { userId: '222222222', userName: 'Bob', amount: 33.34 },
      ],
      createdAt: new Date().toISOString(),
    },
  ],
  settlements: [
    {
      id: 'settlement-1',
      groupId: 'group-1',
      fromUserId: '111111111',
      fromUserName: 'Alice',
      toUserId: '123456789',
      toUserName: 'Test User',
      amount: 33.33,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ],
  balances: {
    '123456789': 66.67, // Test User is owed
    '111111111': -33.33, // Alice owes
    '222222222': -33.34, // Bob owes
  },
};

/**
 * Setup API mocks for the page
 */
export async function setupApiMocks(page: Page) {
  await page.route('**/api/groups', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockApiResponses.groups }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/groups/*/members', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockApiResponses.members }),
    });
  });

  await page.route('**/api/groups/*/expenses', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockApiResponses.expenses,
          pagination: { hasMore: false },
        }),
      });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: `expense-${Date.now()}`, ...body, createdAt: new Date().toISOString() },
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/groups/*/settlements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockApiResponses.settlements,
        pagination: { hasMore: false },
      }),
    });
  });

  await page.route('**/api/groups/*/analytics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          totalExpenses: 100,
          expenseCount: 1,
          balances: mockApiResponses.balances,
          categoryBreakdown: { food: 100 },
          monthlyTrend: [{ month: '2025-01', amount: 100 }],
        },
      }),
    });
  });

  await page.route('**/api/users/*/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          totalOwed: 66.67,
          totalOwing: 0,
          netBalance: 66.67,
          groupCount: 1,
          recentActivity: [],
        },
      }),
    });
  });

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { status: 'ok', timestamp: new Date().toISOString() },
      }),
    });
  });
}
