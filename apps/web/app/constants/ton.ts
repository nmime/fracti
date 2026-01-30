/**
 * TON Blockchain Constants
 */

export const TON_DECIMALS = 9;
export const NANOTON = 10 ** TON_DECIMALS;
export const USDT_DECIMALS = 6;

// TON Center API URL
export const TONCENTER_API_URL = 'https://toncenter.com/api/v3';

// Mainnet Jetton master addresses
export const JETTON_ADDRESSES = {
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
} as const;

export type JettonType = 'USDT';
