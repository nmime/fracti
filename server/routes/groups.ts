import { Hono } from 'hono'
import { randomUUID } from 'crypto'
import {
  getGroup,
  createGroup,
  getGroupsByUser,
  upsertUser,
  getGroupMembers,
} from '../lib/dynamodb'
import { authMiddleware, requireAuth, getDevUser } from '../middleware/auth'

export const groupsRoutes = new Hono()

// Apply auth middleware to all routes
groupsRoutes.use('*', authMiddleware)

// GET /api/groups - List groups for current user
groupsRoutes.get('/', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const groups = await getGroupsByUser(telegramUser.id)

  return c.json(
    groups.map((g) => ({
      id: g.id,
      chatId: g.chatId,
      title: g.title,
      createdAt: g.createdAt,
      memberCount: g.memberCount,
    }))
  )
})

// GET /api/groups/:groupId - Get single group with members
groupsRoutes.get('/:groupId', async (c) => {
  const groupId = c.req.param('groupId')
  const group = await getGroup(groupId)

  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  const members = await getGroupMembers(groupId)

  return c.json({
    ...group,
    memberCount: members.length,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      username: m.username,
      wallet: m.wallet,
    })),
  })
})

// POST /api/groups - Create new group
groupsRoutes.post('/', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const body = await c.req.json()
  const { title, chatId } = body

  if (!title || !chatId) {
    return c.json(
      { error: 'Bad Request', message: 'Missing required fields: title, chatId' },
      400
    )
  }

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

  return c.json(group, 201)
})

// POST /api/groups/:groupId/join - Join a group
groupsRoutes.post('/:groupId/join', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const groupId = c.req.param('groupId')
  const body = await c.req.json().catch(() => ({}))

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  await upsertUser(groupId, {
    id: String(telegramUser.id),
    telegramId: telegramUser.id,
    name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
    username: telegramUser.username,
    wallet: body.wallet,
  })

  return c.json({ success: true, message: 'Joined group successfully' })
})

// PUT /api/groups/:groupId/wallet - Update wallet address
groupsRoutes.put('/:groupId/wallet', requireAuth, async (c) => {
  const telegramUser = c.get('telegramUser') || getDevUser()
  const groupId = c.req.param('groupId')
  const body = await c.req.json()
  const { wallet } = body

  if (!wallet) {
    return c.json({ error: 'Bad Request', message: 'Wallet address required' }, 400)
  }

  const group = await getGroup(groupId)
  if (!group) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  await upsertUser(groupId, {
    id: String(telegramUser.id),
    telegramId: telegramUser.id,
    name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
    username: telegramUser.username,
    wallet,
  })

  return c.json({ success: true, wallet })
})
