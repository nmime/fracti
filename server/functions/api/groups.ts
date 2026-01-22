import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
  getGroup,
  createGroup,
  getGroupsByUser,
  upsertUser,
  getGroupMembers,
} from '../../lib/dynamodb'
import { validateInitData } from '../../lib/telegram'
import { json, error, notFound, unauthorized } from '../../lib/response'
import { randomUUID } from 'crypto'

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const groupId = event.pathParameters?.groupId

  // Validate Telegram init data
  const initData = event.headers['x-telegram-init-data'] || ''
  const telegramUser = validateInitData(initData)

  // For development, allow requests without auth
  const isDev = process.env.AWS_SAM_LOCAL === 'true'

  try {
    switch (method) {
      case 'GET': {
        if (groupId) {
          // Get single group
          const group = await getGroup(groupId)
          if (!group) {
            return notFound('Group not found')
          }

          const members = await getGroupMembers(groupId)

          return json({
            ...group,
            memberCount: members.length,
            members: members.map((m) => ({
              id: m.id,
              name: m.name,
              username: m.username,
              wallet: m.wallet,
            })),
          })
        } else {
          // List groups for user
          if (!telegramUser && !isDev) {
            return unauthorized()
          }

          const telegramId = telegramUser?.id ?? 123456789
          const groups = await getGroupsByUser(telegramId)

          return json(
            groups.map((g) => ({
              id: g.id,
              chatId: g.chatId,
              title: g.title,
              createdAt: g.createdAt,
              memberCount: g.memberCount,
            }))
          )
        }
      }

      case 'POST': {
        if (!telegramUser && !isDev) {
          return unauthorized()
        }

        const body = JSON.parse(event.body || '{}')
        const { title, chatId } = body

        if (!title || !chatId) {
          return error('Missing required fields: title, chatId')
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
        const telegramId = telegramUser?.id ?? 123456789
        await upsertUser(id, {
          id: String(telegramId),
          telegramId,
          name: telegramUser?.first_name ?? 'Demo User',
          username: telegramUser?.username,
        })

        return json(group, 201)
      }

      default:
        return error(`Method ${method} not allowed`, 405)
    }
  } catch (err) {
    console.error('Groups handler error:', err)
    return error('Internal server error', 500)
  }
}
