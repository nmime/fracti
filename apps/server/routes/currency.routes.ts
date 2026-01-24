import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../types/api.types'
import { currencyController } from '../controllers/currency.controller'
import { requireAuth } from '../middleware/auth'

const routes = new Hono<Env>()

const ratesQuerySchema = z.object({
  base: z.string().min(2).max(5).default('TON'),
})

const convertQuerySchema = z.object({
  from: z.string().min(2).max(5),
  to: z.string().min(2).max(5),
  amount: z.coerce.number().positive(),
})

// GET /api/currency/rates - Get exchange rates
routes.get('/rates', requireAuth, zValidator('query', ratesQuerySchema), async (c) => {
  const { base } = c.req.valid('query')
  return currencyController.getRates(c, base)
})

// GET /api/currency/convert - Convert between currencies
routes.get('/convert', requireAuth, zValidator('query', convertQuerySchema), async (c) => {
  const { from, to, amount } = c.req.valid('query')
  return currencyController.convert(c, from, to, amount)
})

export const currencyRoutes = routes
