import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { settlementsService } from '../services/settlements.service'
import { groupsService } from '../services/groups.service'
import { decodeCursor, encodeCursor } from '../utils/cursor'
import type { TelegramUser } from '../integrations/telegram'

export class SettlementsController {
  async list(
    c: Context,
    user: TelegramUser,
    groupId: string,
    limit: number,
    cursor?: string
  ) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const result = await settlementsService.getSettlementsByGroup(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    })

    return c.json({
      success: true,
      data: result.items.map((s) => ({
        id: s.id,
        groupId: s.groupId,
        fromUserId: s.fromUserId,
        fromUserName: s.fromUserName,
        toUserId: s.toUserId,
        toUserName: s.toUserName,
        amount: s.amount,
        currency: s.currency,
        txHash: s.txHash,
        status: s.status,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
      })),
      pagination: {
        hasMore: result.hasMore,
        nextCursor: encodeCursor(result.lastKey),
      },
    })
  }

  async getById(c: Context, user: TelegramUser, groupId: string, settlementId: string) {
    const settlement = await settlementsService.getSettlementById(settlementId)

    if (!settlement) {
      throw new HTTPException(404, { message: 'Settlement not found' })
    }

    if (settlement.groupId !== groupId) {
      throw new HTTPException(404, { message: 'Settlement not found in this group' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    return c.json({
      success: true,
      data: {
        id: settlement.id,
        groupId: settlement.groupId,
        fromUserId: settlement.fromUserId,
        fromUserName: settlement.fromUserName,
        toUserId: settlement.toUserId,
        toUserName: settlement.toUserName,
        amount: settlement.amount,
        currency: settlement.currency,
        txHash: settlement.txHash,
        status: settlement.status,
        createdAt: settlement.createdAt,
        completedAt: settlement.completedAt,
      },
    })
  }

  async create(
    c: Context,
    user: TelegramUser,
    groupId: string,
    toId: string,
    amount: number,
    txHash?: string
  ) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    try {
      const settlement = await settlementsService.createSettlement(
        groupId,
        String(user.id),
        toId,
        amount,
        group.currency,
        txHash
      )

      return c.json(
        {
          success: true,
          data: {
            id: settlement.id,
            groupId: settlement.groupId,
            fromUserId: settlement.fromUserId,
            fromUserName: settlement.fromUserName,
            toUserId: settlement.toUserId,
            toUserName: settlement.toUserName,
            amount: settlement.amount,
            currency: settlement.currency,
            txHash: settlement.txHash,
            status: settlement.status,
            createdAt: settlement.createdAt,
          },
        },
        201
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'Settlement participants not found in group') {
        throw new HTTPException(400, { message: error.message })
      }
      throw error
    }
  }

  async update(
    c: Context,
    groupId: string,
    settlementId: string,
    status?: 'pending' | 'completed' | 'failed',
    txHash?: string
  ) {
    try {
      if (status) {
        await settlementsService.updateSettlementStatus(groupId, settlementId, status, txHash)
      }
      return c.json({ success: true, message: 'Settlement updated' })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Settlement not found') {
          throw new HTTPException(404, { message: error.message })
        }
        if (error.message === 'Settlement not found in this group') {
          throw new HTTPException(404, { message: error.message })
        }
      }
      throw error
    }
  }

  async verifyPayment(c: Context, groupId: string, settlementId: string, txHash: string) {
    try {
      const result = await settlementsService.verifyPayment(groupId, settlementId, txHash)

      return c.json({
        success: true,
        data: {
          verified: result.verified,
          error: result.error,
          details: result.details,
        },
      })
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Settlement not found') {
          throw new HTTPException(404, { message: error.message })
        }
        if (error.message === 'Recipient wallet not found') {
          throw new HTTPException(400, { message: error.message })
        }
      }
      throw error
    }
  }

  async getDebts(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const isMember = await groupsService.isMember(groupId, user.id)
    if (!isMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' })
    }

    const debts = await settlementsService.calculateDebts(groupId)

    return c.json({
      success: true,
      data: debts,
    })
  }
}

export const settlementsController = new SettlementsController()
