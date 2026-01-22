import { logger } from './logger'

/**
 * Currency conversion service using exchange rate APIs
 */

// Supported currencies
export const SUPPORTED_CURRENCIES = [
  'TON',
  'USD',
  'EUR',
  'GBP',
  'RUB',
  'UAH',
  'USDT',
  'BTC',
  'ETH',
] as const

export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

// Cache for exchange rates (5 minute TTL)
interface RateCache {
  rates: Record<string, number>
  timestamp: number
}

const rateCache: Map<string, RateCache> = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch TON price from CoinGecko (free API)
 */
async function fetchTonPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data = await response.json()
    return data['the-open-network']?.usd ?? 0
  } catch (error) {
    logger.error('Failed to fetch TON price', {}, error as Error)
    return 0
  }
}

/**
 * Fetch fiat exchange rates (using exchangerate.host - free API)
 */
async function fetchFiatRates(baseCurrency: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(
      `https://api.exchangerate.host/latest?base=${baseCurrency}`
    )

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`)
    }

    const data = await response.json()
    return data.rates ?? {}
  } catch (error) {
    logger.error('Failed to fetch fiat rates', { baseCurrency }, error as Error)
    return {}
  }
}

/**
 * Get exchange rates with caching
 */
async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const cacheKey = baseCurrency.toUpperCase()
  const cached = rateCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rates
  }

  // Fetch new rates
  const [tonPrice, fiatRates] = await Promise.all([
    fetchTonPrice(),
    fetchFiatRates(baseCurrency === 'TON' ? 'USD' : baseCurrency),
  ])

  // Build rates object
  const rates: Record<string, number> = { ...fiatRates }

  // Add TON rates
  if (tonPrice > 0) {
    if (baseCurrency === 'TON') {
      rates['USD'] = tonPrice
      rates['TON'] = 1
      // Convert all fiat rates to TON base
      for (const [currency, rate] of Object.entries(fiatRates)) {
        rates[currency] = rate * tonPrice
      }
    } else if (baseCurrency === 'USD') {
      rates['TON'] = 1 / tonPrice
    } else {
      // Convert via USD
      const usdRate = fiatRates['USD'] ?? 1
      rates['TON'] = usdRate / tonPrice
    }
  }

  // Add stablecoin rates (1:1 with USD)
  const usdRate = rates['USD'] ?? 1
  rates['USDT'] = usdRate

  // Cache the rates
  rateCache.set(cacheKey, {
    rates,
    timestamp: Date.now(),
  })

  return rates
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount
  }

  // Handle stablecoins (USDT = USD)
  const from = fromCurrency === 'USDT' ? 'USD' : fromCurrency
  const to = toCurrency === 'USDT' ? 'USD' : toCurrency

  if (from === to) {
    return amount
  }

  const rates = await getExchangeRates(from)
  const rate = rates[to]

  if (!rate || rate === 0) {
    logger.warn('Exchange rate not found', { from, to })
    return amount // Return original amount if conversion fails
  }

  return amount * rate
}

/**
 * Get current exchange rate between two currencies
 */
export async function getExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<number | null> {
  if (fromCurrency === toCurrency) {
    return 1
  }

  const rates = await getExchangeRates(fromCurrency)
  return rates[toCurrency] ?? null
}

/**
 * Format currency amount with proper decimals
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const decimals = ['TON', 'BTC', 'ETH'].includes(currency) ? 4 : 2
  return `${amount.toFixed(decimals)} ${currency}`
}

/**
 * Get all exchange rates for a base currency
 */
export async function getAllRates(
  baseCurrency: Currency
): Promise<Record<Currency, number>> {
  const rates = await getExchangeRates(baseCurrency)

  const result: Partial<Record<Currency, number>> = { [baseCurrency]: 1 }

  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency !== baseCurrency) {
      result[currency] = rates[currency] ?? 0
    }
  }

  return result as Record<Currency, number>
}

/**
 * Convert expense splits to a different currency
 */
export async function convertExpenseCurrency(
  amount: number,
  splits: Array<{ userId: string; userName: string; amount: number }>,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<{
  amount: number
  splits: Array<{ userId: string; userName: string; amount: number }>
}> {
  if (fromCurrency === toCurrency) {
    return { amount, splits }
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency)
  if (!rate) {
    return { amount, splits }
  }

  return {
    amount: amount * rate,
    splits: splits.map((s) => ({
      ...s,
      amount: s.amount * rate,
    })),
  }
}
