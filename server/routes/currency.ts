import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { Env } from '../lib/factory'
import { authMiddleware, requireAuth } from '../middleware/auth'
import {
  convertCurrency,
  getExchangeRates,
  SUPPORTED_CURRENCIES,
} from '../lib/currency'

export const currencyRoutes = new Hono<Env>()

currencyRoutes.use('*', authMiddleware)

const convertSchema = z.object({
  amount: z.number().positive(),
  from: z.string().min(1).max(10),
  to: z.string().min(1).max(10),
})

const ratesQuerySchema = z.object({
  base: z.string().optional(),
})

// POST /api/currency/convert - Convert currency
currencyRoutes.post(
  '/convert',
  requireAuth,
  zValidator('json', convertSchema),
  async (c) => {
    const { amount, from, to } = c.req.valid('json')

    const convertedAmount = await convertCurrency(amount, from, to)
    const rate = convertedAmount / amount

    return c.json({
      success: true,
      data: {
        from,
        to,
        amount,
        convertedAmount,
        rate,
        timestamp: new Date().toISOString(),
      },
    })
  }
)

// GET /api/currency/rates - Get exchange rates
currencyRoutes.get(
  '/rates',
  requireAuth,
  zValidator('query', ratesQuerySchema),
  async (c) => {
    const { base = 'USD' } = c.req.valid('query')

    const rates = await getExchangeRates(base)

    return c.json({
      success: true,
      data: {
        base,
        rates,
        timestamp: new Date().toISOString(),
      },
    })
  }
)

// GET /api/currency/supported - Get supported currencies
currencyRoutes.get('/supported', requireAuth, async (c) => {
  const currencies = SUPPORTED_CURRENCIES.map((code) => {
    const info = getCurrencyInfo(code)
    return {
      code,
      name: info.name,
      symbol: info.symbol,
      type: info.type,
    }
  })

  return c.json({
    success: true,
    data: currencies,
  })
})

function getCurrencyInfo(code: string): { name: string; symbol: string; type: 'fiat' | 'crypto' } {
  const currencies: Record<string, { name: string; symbol: string; type: 'fiat' | 'crypto' }> = {
    TON: { name: 'Toncoin', symbol: '💎', type: 'crypto' },
    USD: { name: 'US Dollar', symbol: '$', type: 'fiat' },
    EUR: { name: 'Euro', symbol: '€', type: 'fiat' },
    GBP: { name: 'British Pound', symbol: '£', type: 'fiat' },
    RUB: { name: 'Russian Ruble', symbol: '₽', type: 'fiat' },
    UAH: { name: 'Ukrainian Hryvnia', symbol: '₴', type: 'fiat' },
    USDT: { name: 'Tether USD', symbol: '$', type: 'crypto' },
    USDC: { name: 'USD Coin', symbol: '$', type: 'crypto' },
    BTC: { name: 'Bitcoin', symbol: '₿', type: 'crypto' },
    ETH: { name: 'Ethereum', symbol: 'Ξ', type: 'crypto' },
  }
  return currencies[code] ?? { name: code, symbol: code, type: 'crypto' }
}
