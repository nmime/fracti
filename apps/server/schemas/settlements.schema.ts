import { z } from 'zod'
import { safeAmount, txHash } from './common.schema'

export const createSettlementSchema = z.object({
  toId: z.string().min(1, 'Recipient ID is required'),
  amount: safeAmount,
  txHash: txHash.optional(),
})

export const updateSettlementSchema = z.object({
  txHash: txHash.optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
})

export const settlementIdParamSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  settlementId: z.string().uuid('Invalid settlement ID'),
})

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>
export type SettlementIdParam = z.infer<typeof settlementIdParamSchema>
