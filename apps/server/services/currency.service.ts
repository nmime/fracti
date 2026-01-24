import { logger } from '../utils/logger'

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

interface RateCache {
  rates: Record<string, number>
  timestamp: number
}

const rateCache: Map<string, RateCache> = new Map()
const CACHE_TTL = 5 * 60 * 1000

async function fetchTonPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data = (await response.json()) as Record<string, { usd?: number }>
    return data['the-open-network']?.usd ?? 0
  } catch (error) {
    logger.error('Failed to fetch TON price', {}, error as Error)
    return 0
  }
}

async function fetchFiatRates(baseCurrency: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(`https://api.exchangerate.host/latest?base=${baseCurrency}`)

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`)
    }

    const data = (await response.json()) as { rates?: Record<string, number> }
    return data.rates ?? {}
  } catch (error) {
    logger.error('Failed to fetch fiat rates', { baseCurrency }, error as Error)
    return {}
  }
}

class CurrencyService {
  async getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
    const cacheKey = baseCurrency.toUpperCase()
    const cached = rateCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.rates
    }

    const [tonPrice, fiatRates] = await Promise.all([
      fetchTonPrice(),
      fetchFiatRates(baseCurrency === 'TON' ? 'USD' : baseCurrency),
    ])

    const rates: Record<string, number> = { ...fiatRates }

    if (tonPrice > 0) {
      if (baseCurrency === 'TON') {
        rates['USD'] = tonPrice
        rates['TON'] = 1
        for (const [currency, rate] of Object.entries(fiatRates)) {
          rates[currency] = rate * tonPrice
        }
      } else if (baseCurrency === 'USD') {
        rates['TON'] = 1 / tonPrice
      } else {
        const usdRate = fiatRates['USD'] ?? 1
        rates['TON'] = usdRate / tonPrice
      }
    }

    const usdRate = rates['USD'] ?? 1
    rates['USDT'] = usdRate

    rateCache.set(cacheKey, {
      rates,
      timestamp: Date.now(),
    })

    return rates
  }

  async convertCurrency(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount
    }

    const from = fromCurrency === 'USDT' ? 'USD' : fromCurrency
    const to = toCurrency === 'USDT' ? 'USD' : toCurrency

    if (from === to) {
      return amount
    }

    const rates = await this.getExchangeRates(from)
    const rate = rates[to]

    if (!rate || rate === 0) {
      logger.warn('Exchange rate not found', { from, to })
      return amount
    }

    return amount * rate
  }

  async getExchangeRate(fromCurrency: Currency, toCurrency: Currency): Promise<number | null> {
    if (fromCurrency === toCurrency) {
      return 1
    }

    const rates = await this.getExchangeRates(fromCurrency)
    return rates[toCurrency] ?? null
  }

  formatCurrency(amount: number, currency: Currency): string {
    const decimals = ['TON', 'BTC', 'ETH'].includes(currency) ? 4 : 2
    return `${amount.toFixed(decimals)} ${currency}`
  }

  async getAllRates(baseCurrency: Currency): Promise<Record<Currency, number>> {
    const rates = await this.getExchangeRates(baseCurrency)

    const result: Partial<Record<Currency, number>> = { [baseCurrency]: 1 }

    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency !== baseCurrency) {
        result[currency] = rates[currency] ?? 0
      }
    }

    return result as Record<Currency, number>
  }
}

export const currencyService = new CurrencyService()
