import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../types/api.types'
import { authController } from '../controllers/auth.controller'

const routes = new Hono<Env>()

const widgetDataSchema = z.record(z.string(), z.string())

const initDataSchema = z.object({
  initData: z.string().min(1),
})

// POST /api/auth/telegram-widget - Validate Telegram Login Widget
routes.post('/telegram-widget', zValidator('json', widgetDataSchema), async (c) => {
  const data = c.req.valid('json')
  return authController.validateWidgetData(c, data)
})

// POST /api/auth/init-data - Validate Mini App init data
routes.post('/init-data', zValidator('json', initDataSchema), async (c) => {
  const { initData } = c.req.valid('json')
  return authController.validateInitData(c, initData)
})

export const authRoutes = routes
