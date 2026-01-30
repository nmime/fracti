import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { aiController } from '../controllers';
import { requireAuth } from '../middleware/auth';
import { parseTextSchema, parseVisionSchema } from '../schemas';
import type { Env } from '../types/api.types';

const routes = new Hono<Env>();

// POST /api/ai/parse - Parse expense from natural language text
routes.post('/parse', requireAuth, zValidator('json', parseTextSchema), async (c) => {
  const { text } = c.req.valid('json');

  return aiController.parseText(c, text);
});

// POST /api/ai/vision - Parse receipt image
routes.post('/vision', requireAuth, zValidator('json', parseVisionSchema), async (c) => {
  const { image, mimeType } = c.req.valid('json');

  return aiController.parseVision(c, image, mimeType);
});

export const aiRoutes = routes;
