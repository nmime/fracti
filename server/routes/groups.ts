import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { zValidator } from '@hono/zod-validator'
import { randomUUID } from 'crypto'

import type { Env } from '../lib/factory'
import {
  getGroup,
  createGroup,
  getGroupsByUser,
  upsertUser,
  getGroupMembers,
} from '../lib/dynamodb'
import { transformAvatarUrl } from '../lib/s3'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'
import {
  groupIdParamSchema,
  createGroupSchema,
  joinGroupSchema,
  updateWalletSchema,
} from '../lib/schemas'

export const groupsRoutes = new Hono<Env>()

// Apply auth middleware to all routes
groupsRoutes.use('*', authMiddleware)

// GET /api/groups - List groups for current user
groupsRoutes.get('/', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const memberships = await getGroupsByUser(telegramUser.id)

  // Extract group IDs from memberships and fetch full group details
  const groupIds = memberships
    .map((m) => m.GSI1SK?.replace('GROUP#', ''))
    .filter(Boolean) as string[]

  const groups = await Promise.all(groupIds.map((id) => getGroup(id)))

  return c.json({
    success: true,
    data: groups
      .filter(Boolean)
      .map((g) => ({
        id: g!.id,
        chatId: g!.chatId,
        title: g!.title,
        currency: g!.currency,
        createdAt: g!.createdAt,
        memberCount: g!.memberCount,
      })),
  })
})

// GET /api/groups/:groupId - Get single group with members
groupsRoutes.get(
  '/:groupId',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  async (c) => {
    const { groupId } = c.req.valid('param')
    const group = await getGroup(groupId)

    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    const members = await getGroupMembers(groupId)

    return c.json({
      success: true,
      data: {
        ...group,
        memberCount: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          username: m.username,
          wallet: m.wallet,
          avatarUrl: transformAvatarUrl(m.avatarUrl),
        })),
      },
    })
  }
)

// POST /api/groups - Create new group
groupsRoutes.post(
  '/',
  requireAuth,
  zValidator('json', createGroupSchema),
  async (c) => {
    const telegramUser = c.get('telegramUser') || getDevUser()
    const { title, chatId } = c.req.valid('json')

    const id = randomUUID()
    const now = new Date().toISOString()

    const group = await createGroup({
      id,
      chatId: String(chatId),
      title,
      createdAt: now,
      memberCount: 1,
    })

    // Add creator as first member
    await upsertUser(id, {
      id: String(telegramUser.id),
      telegramId: telegramUser.id,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
    })

    return c.json({ success: true, data: group }, 201)
  }
)

// POST /api/groups/:groupId/join - Join a group
groupsRoutes.post(
  '/:groupId/join',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', joinGroupSchema),
  async (c) => {
    const telegramUser = c.get('telegramUser') || getDevUser()
    const { groupId } = c.req.valid('param')
    const { wallet } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    await upsertUser(groupId, {
      id: String(telegramUser.id),
      telegramId: telegramUser.id,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
      wallet,
    })

    return c.json({ success: true, message: 'Joined group successfully' })
  }
)

// PUT /api/groups/:groupId/wallet - Update wallet address
groupsRoutes.put(
  '/:groupId/wallet',
  requireAuth,
  zValidator('param', groupIdParamSchema),
  zValidator('json', updateWalletSchema),
  async (c) => {
    const telegramUser = c.get('telegramUser') || getDevUser()
    const { groupId } = c.req.valid('param')
    const { wallet } = c.req.valid('json')

    const group = await getGroup(groupId)
    if (!group) {
      throw new HTTPException(404, { message: 'Group not found' })
    }

    await upsertUser(groupId, {
      id: String(telegramUser.id),
      telegramId: telegramUser.id,
      name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
      username: telegramUser.username,
      wallet,
    })

    return c.json({ success: true, data: { wallet } })
  }
)
