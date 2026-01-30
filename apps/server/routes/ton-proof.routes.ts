import { Hono } from 'hono';
import { generatePayload, verifyTonProof, type CheckProofRequest } from '../services/ton-proof.service';
import { validateInitData } from '../integrations/telegram';
import { requireAuth, getCurrentUser } from '../middleware/auth';
import { getGroupsByUser, updateUserWallet, saveTonConnectSession, getTonConnectSession, deleteTonConnectSession } from '@libs/db';
import { logger } from '../utils/logger';
import type { Env } from '../types/api.types';

const tonProofRoutes = new Hono<Env>();

/**
 * Generate a payload for TON Proof verification
 * Called before wallet connection to get a challenge
 */
tonProofRoutes.post('/payload', async (c) => {
  try {
    const payload = generatePayload();

    return c.json({
      success: true,
      payload: payload.payload,
      expiresAt: payload.expiresAt,
    });
  } catch (error) {
    logger.error('Failed to generate TON proof payload', {}, error as Error);
    return c.json({ success: false, error: 'Failed to generate payload' }, 500);
  }
});

/**
 * Verify TON Proof after wallet connection
 * Confirms the user owns the wallet they connected
 * Saves the wallet address to the user's profile
 */
tonProofRoutes.post('/verify', async (c) => {
  try {
    const body = await c.req.json<CheckProofRequest>();

    if (!body.proof || !body.wallet) {
      return c.json({ success: false, error: 'Missing proof or wallet data' }, 400);
    }

    const result = await verifyTonProof(body);

    if (!result.valid) {
      logger.warn('TON Proof verification failed', {
        error: result.error,
        address: body.wallet.address,
      });
      return c.json({ success: false, error: result.error }, 401);
    }

    // Get the Telegram user from init data to link wallet to user
    const initData = c.req.header('x-telegram-init-data') || '';
    const telegramUser = validateInitData(initData);

    if (telegramUser && result.address) {
      // Save wallet to all user's group memberships
      try {
        const memberships = await getGroupsByUser(telegramUser.id);

        if (memberships.length > 0) {
          await Promise.all(
            memberships
              .map((m) => m.GSI1SK?.replace('GROUP#', ''))
              .filter((groupId): groupId is string => !!groupId)
              .map((groupId) => updateUserWallet(groupId, telegramUser.id, result.address!))
          );

          logger.info('Wallet saved to user profile', {
            telegramId: telegramUser.id,
            address: result.address,
            groupCount: memberships.length,
          });
        } else {
          logger.info('Wallet verified but user has no group memberships yet', {
            telegramId: telegramUser.id,
            address: result.address,
          });
        }
      } catch (dbError) {
        // Log but don't fail - wallet verified, just couldn't save
        logger.error('Failed to save wallet to user profile', { telegramId: telegramUser.id }, dbError as Error);
      }
    }

    return c.json({
      success: true,
      address: result.address,
      verified: true,
    });
  } catch (error) {
    logger.error('TON Proof verification error', {}, error as Error);
    return c.json({ success: false, error: 'Verification failed' }, 500);
  }
});

/**
 * Save TON Connect session data for cross-device persistence
 * Supports both JWT and initData auth
 */
tonProofRoutes.post('/session', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);

    const body = await c.req.json<{ key: string; value: string }>();
    if (!body.key) {
      return c.json({ success: false, error: 'Missing key' }, 400);
    }

    // Get existing session and merge
    const existing = await getTonConnectSession(user.id) || {};

    if (body.value) {
      existing[body.key] = body.value;
    } else {
      delete existing[body.key];
    }

    await saveTonConnectSession(user.id, existing);

    return c.json({ success: true, data: { saved: true } });
  } catch (error) {
    logger.error('Failed to save TON Connect session', {}, error as Error);
    return c.json({ success: false, error: 'Failed to save session' }, 500);
  }
});

/**
 * Get TON Connect session data for restoring connection
 * Supports both JWT and initData auth
 */
tonProofRoutes.get('/session', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);
    const session = await getTonConnectSession(user.id);

    return c.json({
      success: true,
      data: { session: session || {} },
    });
  } catch (error) {
    logger.error('Failed to get TON Connect session', {}, error as Error);
    return c.json({ success: false, error: 'Failed to get session' }, 500);
  }
});

/**
 * Delete TON Connect session (on disconnect)
 * Supports both JWT and initData auth
 */
tonProofRoutes.delete('/session', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);
    await deleteTonConnectSession(user.id);

    return c.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('Failed to delete TON Connect session', {}, error as Error);
    return c.json({ success: false, error: 'Failed to delete session' }, 500);
  }
});

export { tonProofRoutes };
