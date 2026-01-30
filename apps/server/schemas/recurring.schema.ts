import { groupIdParamSchema } from './common.schema';
import type { z } from 'zod';

/**
 * Re-export groupIdParamSchema for recurring routes
 */
export { groupIdParamSchema };

export type GroupIdParam = z.infer<typeof groupIdParamSchema>;
