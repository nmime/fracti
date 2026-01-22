import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
  getExpenses,
  createExpense,
  deleteExpense,
  getGroup,
  getGroupMembers,
  upsertUser,
} from '../../lib/dynamodb'
import { validateInitData } from '../../lib/telegram'
import { json, error, notFound, unauthorized } from '../../lib/response'
import { randomUUID } from 'crypto'

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const groupId = event.pathParameters?.groupId
  const expenseId = event.pathParameters?.expenseId

  if (!groupId) {
    return error('Group ID required')
  }

  // Validate Telegram init data
  const initData = event.headers['x-telegram-init-data'] || ''
  const telegramUser = validateInitData(initData)
  const isDev = process.env.AWS_SAM_LOCAL === 'true'

  try {
    // Verify group exists
    const group = await getGroup(groupId)
    if (!group) {
      return notFound('Group not found')
    }

    switch (method) {
      case 'GET': {
        const expenses = await getExpenses(groupId)

        return json(
          expenses.map((e) => ({
            id: e.id,
            groupId: e.groupId,
            payerId: e.payerId,
            payerName: e.payerName,
            amount: e.amount,
            description: e.description,
            splitType: e.splitType,
            splits: e.splits,
            createdAt: e.createdAt,
          }))
        )
      }

      case 'POST': {
        if (!telegramUser && !isDev) {
          return unauthorized()
        }

        const body = JSON.parse(event.body || '{}')
        const { payerId, amount, description, splitType, splits } = body

        if (!payerId || !amount || !description || !splits) {
          return error('Missing required fields')
        }

        // Get members to resolve names
        const members = await getGroupMembers(groupId)
        const memberMap = new Map(members.map((m) => [m.id, m]))

        const payer = memberMap.get(payerId)
        if (!payer) {
          return error('Payer not found in group')
        }

        const id = randomUUID()
        const now = new Date().toISOString()

        const expense = await createExpense({
          id,
          groupId,
          payerId,
          payerName: payer.name,
          amount: Number(amount),
          description,
          splitType: splitType || 'equal',
          splits: splits.map((s: { userId: string; amount?: number }) => {
            const member = memberMap.get(s.userId)
            return {
              userId: s.userId,
              userName: member?.name ?? 'Unknown',
              amount: s.amount ?? amount / splits.length,
            }
          }),
          createdAt: now,
        })

        return json(expense, 201)
      }

      case 'DELETE': {
        if (!expenseId) {
          return error('Expense ID required')
        }

        if (!telegramUser && !isDev) {
          return unauthorized()
        }

        // Find expense by ID
        const expenses = await getExpenses(groupId)
        const expense = expenses.find((e) => e.id === expenseId)

        if (!expense) {
          return notFound('Expense not found')
        }

        await deleteExpense(groupId, expense.createdAt)

        return json({ success: true })
      }

      default:
        return error(`Method ${method} not allowed`, 405)
    }
  } catch (err) {
    console.error('Expenses handler error:', err)
    return error('Internal server error', 500)
  }
}
