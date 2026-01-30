import { z } from 'zod';

export const updateLanguageSchema = z.object({
  languageCode: z.enum(['en', 'ru']),
});

export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
