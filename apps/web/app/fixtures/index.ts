/**
 * Development/Demo fixtures for testing and local development.
 * In production, data is fetched from the API.
 */
import type { DebtGraph, Group, Expense, Settlement, User, ParsedReceipt } from '@/services';

/**
 * Demo user for development mode (when not in Telegram WebApp)
 */
export const demoUser = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demouser',
};

/**
 * Demo group
 */
export const demoGroup: Group = {
  id: 'demo',
  chatId: '123456',
  title: 'Vegas Trip',
  createdAt: new Date().toISOString(),
  memberCount: 4,
};

/**
 * Demo members list
 */
export const demoMembers: User[] = [
  { id: '1', telegramId: 123456789, name: 'You', username: 'you' },
  { id: '2', telegramId: 111111111, name: 'Alice', username: 'alice' },
  { id: '3', telegramId: 222222222, name: 'Bob', username: 'bob' },
  { id: '4', telegramId: 333333333, name: 'Charlie', username: 'charlie' },
];

/**
 * Demo debt graph for visualization
 */
export const demoDebtGraph: DebtGraph = {
  nodes: [
    { id: '1', name: 'You', balance: 45.5, wallet: 'EQA...' },
    { id: '2', name: 'Alice', balance: -22.0 },
    { id: '3', name: 'Bob', balance: -15.5 },
    { id: '4', name: 'Charlie', balance: -8.0 },
  ],
  edges: [
    { from: '2', to: '1', amount: 22.0 },
    { from: '3', to: '1', amount: 15.5 },
    { from: '4', to: '1', amount: 8.0 },
  ],
};

/**
 * Demo expenses
 */
export function createDemoExpenses(): Expense[] {
  return [
    {
      id: '1',
      groupId: 'demo',
      payerId: '2',
      payerName: 'Alice',
      amount: 120,
      currency: 'TON',
      description: 'Dinner at Italian Restaurant',
      splitType: 'equal',
      splits: [
        { userId: '1', userName: 'You', amount: 30 },
        { userId: '2', userName: 'Alice', amount: 30 },
        { userId: '3', userName: 'Bob', amount: 30 },
        { userId: '4', userName: 'Charlie', amount: 30 },
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      groupId: 'demo',
      payerId: '1',
      payerName: 'You',
      amount: 85,
      currency: 'TON',
      description: 'Groceries',
      splitType: 'equal',
      splits: [
        { userId: '1', userName: 'You', amount: 28.33 },
        { userId: '2', userName: 'Alice', amount: 28.33 },
        { userId: '3', userName: 'Bob', amount: 28.34 },
      ],
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      groupId: 'demo',
      payerId: '3',
      payerName: 'Bob',
      amount: 35,
      currency: 'TON',
      description: 'Uber to airport',
      splitType: 'equal',
      splits: [
        { userId: '1', userName: 'You', amount: 17.5 },
        { userId: '3', userName: 'Bob', amount: 17.5 },
      ],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

/**
 * Demo settlements
 */
export function createDemoSettlements(): Settlement[] {
  return [
    {
      id: '1',
      groupId: 'demo',
      fromUserId: '1',
      fromUserName: 'You',
      toUserId: '2',
      toUserName: 'Alice',
      amount: 22.0,
      currency: 'TON',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      groupId: 'demo',
      fromUserId: '3',
      fromUserName: 'Bob',
      toUserId: '1',
      toUserName: 'You',
      amount: 15.5,
      currency: 'TON',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      groupId: 'demo',
      fromUserId: '4',
      fromUserName: 'Charlie',
      toUserId: '2',
      toUserName: 'Alice',
      amount: 8.0,
      currency: 'TON',
      status: 'completed',
      txHash: 'abc123def456...',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

/**
 * Demo wallet addresses for settlements
 */
export const demoWalletAddresses: Record<string, string> = {
  '1': 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  '2': 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
  '3': 'EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2',
  '4': 'EQAXRGnNd0HO2G0J8eHNvJY6nXXgQn8TQtVzLw8NNJS6_Tci',
};

/**
 * Demo parsed receipt for AI scan feature
 */
export const demoReceipt: ParsedReceipt = {
  items: [
    { name: 'Margherita Pizza', quantity: 2, price: 24.0 },
    { name: 'Caesar Salad', quantity: 1, price: 12.0 },
    { name: 'Sparkling Water', quantity: 3, price: 9.0 },
    { name: 'Tiramisu', quantity: 2, price: 16.0 },
    { name: 'Espresso', quantity: 4, price: 12.0 },
  ],
  total: 73.0,
  tax: 7.3,
  subtotal: 65.7,
  currency: 'TON',
  merchant: 'La Bella Italia',
  date: '2026-01-22',
  confidence: 0.94,
};

/**
 * Demo recent activity for home page
 */
export const demoRecentActivity = [
  { name: 'Alice', item: 'Dinner', amount: 120, hours: 2 },
  { name: 'Bob', item: 'Uber', amount: 35, hours: 4 },
  { name: 'You', item: 'Groceries', amount: 85, hours: 6 },
];
