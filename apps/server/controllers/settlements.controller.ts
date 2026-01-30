import { HTTPException } from 'hono/http-exception';
import { getUser } from '@libs/db';
import { groupsService, settlementsService } from '../services';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import type { TelegramUser } from '../integrations/telegram';
import type { Context } from 'hono';

export class SettlementsController {
  async list(c: Context, user: TelegramUser, groupId: string, limit: number, cursor?: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[list] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    const result = await settlementsService.getSettlementsByGroup(groupId, {
      limit,
      lastKey: decodeCursor(cursor),
    });

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
    });
  }

  async getById(c: Context, user: TelegramUser, groupId: string, settlementId: string) {
    const settlement = await settlementsService.getSettlementById(settlementId);

    if (!settlement) {
      throw new HTTPException(404, { message: 'Settlement not found' });
    }

    if (settlement.groupId !== groupId) {
      throw new HTTPException(404, { message: 'Settlement not found in this group' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getById settlement] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
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
    });
  }

  async create(c: Context, user: TelegramUser, groupId: string, toId: string, amount: number, txHash?: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[create settlement] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    // Get the current user's member record to get their UUID
    const currentMember = await getUser(groupId, user.id);
    if (!currentMember) {
      throw new HTTPException(403, { message: 'You are not a member of this group' });
    }

    try {
      const settlement = await settlementsService.createSettlement(
        groupId,
        currentMember.id,
        toId,
        amount,
        group.currency,
        txHash,
      );

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
        201,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Settlement participants not found in group') {
        throw new HTTPException(400, { message: error.message });
      }

      throw error;
    }
  }

  async update(
    c: Context,
    groupId: string,
    settlementId: string,
    status?: 'pending' | 'completed' | 'failed',
    txHash?: string,
  ) {
    try {
      if (status) {
        await settlementsService.updateSettlementStatus(groupId, settlementId, status, txHash);
      }

      return c.json({ success: true, message: 'Settlement updated' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Settlement not found') {
          throw new HTTPException(404, { message: error.message });
        }

        if (error.message === 'Settlement not found in this group') {
          throw new HTTPException(404, { message: error.message });
        }
      }

      throw error;
    }
  }

  async verifyPayment(c: Context, groupId: string, settlementId: string, txHash: string) {
    try {
      const result = await settlementsService.verifyPayment(groupId, settlementId, txHash);

      return c.json({
        success: true,
        data: {
          verified: result.verified,
          error: result.error,
          details: result.details,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Settlement not found') {
          throw new HTTPException(404, { message: error.message });
        }

        if (error.message === 'Recipient wallet not found') {
          throw new HTTPException(400, { message: error.message });
        }
      }

      throw error;
    }
  }

  async getDebts(c: Context, user: TelegramUser, groupId: string) {
    const group = await groupsService.getGroupById(groupId);
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' });
    }

    // Auto-join user to group if not already a member
    // This is valid because authenticated Telegram users accessing the Mini App
    // must have access to the group through Telegram
    const isMember = await groupsService.isMember(groupId, user.id);
    if (!isMember) {
      console.log('[getDebts] Auto-joining user to group', { groupId, telegramId: user.id });
      await groupsService.joinGroup(groupId, user);
    }

    // Get the current user's member record to get their UUID
    const currentMember = await getUser(groupId, user.id);

    // Get both the debt graph and optimized settlements
    const [graph, suggestedSettlements] = await Promise.all([
      settlementsService.getDebtGraph(groupId),
      settlementsService.calculateDebts(groupId),
    ]);

    // Rename nodes for current user (mark as "You") - use member UUID
    const currentMemberId = currentMember?.id;
    const nodesWithYou = graph.nodes.map((node) => ({
      ...node,
      name: currentMemberId && node.id === currentMemberId ? 'You' : node.name,
    }));

    return c.json({
      success: true,
      data: {
        graph: {
          nodes: nodesWithYou,
          edges: graph.edges,
        },
        suggestedSettlements,
        balances: nodesWithYou,
        summary: {
          totalExpenses: 0,
          totalSettled: 0,
          expenseCount: 0,
          settlementCount: 0,
          pendingSettlements: suggestedSettlements.length,
        },
      },
    });
  }
}

export const settlementsController = new SettlementsController();
