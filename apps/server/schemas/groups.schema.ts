import { z } from 'zod';
import { tonWalletAddress } from './common.schema';

export const createGroupSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  chatId: z.union([z.string(), z.number()]).transform(String),
});

export const joinGroupSchema = z.object({
  wallet: tonWalletAddress.optional(),
});

export const updateWalletSchema = z.object({
  wallet: tonWalletAddress,
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
