/**
 * TON Blockchain Constants
 */

export const TON_DECIMALS = 9
export const NANOTON = 10 ** TON_DECIMALS
export const USDT_DECIMALS = 6

// Mainnet Jetton master addresses
export const JETTON_ADDRESSES = {
  USDT: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
  USDC: 'EQCpF7rvN-4kJlvh1iWguC4QVVBgrsU4IH7nN3v8I_f7q4U8',
} as const

export type JettonType = 'USDT' | 'USDC'
