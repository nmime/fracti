import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
  getGroup,
  getGroupMembers,
  getExpenses,
  getSettlements,
  createSettlement,
  updateSettlementStatus,
} from '../../lib/dynamodb'
import {
  calculateBalances,
  buildDebtGraph,
  optimizeSettlements,
} from '../../lib/debt-graph'
import { validateInitData } from '../../lib/telegram'
import { json, error, notFound, unauthorized } from '../../lib/response'
import { randomUUID } from 'crypto'

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method
  const path = event.requestContext.http.path
  const groupId = event.pathParameters?.groupId

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

    // Get members, expenses, and settlements
    const [members, expenses, settlements] = await Promise.all([
      getGroupMembers(groupId),
      getExpenses(groupId),
      getSettlements(groupId),
    ])

    // Handle /debts endpoint
    if (path.endsWith('/debts')) {
      const balances = calculateBalances(expenses, settlements, members)
      const debtGraph = buildDebtGraph(balances, members)
      return json(debtGraph)
    }

    switch (method) {
      case 'GET': {
        // Get optimized settlements
        const balances = calculateBalances(expenses, settlements, members)
        const optimized = optimizeSettlements(balances, members)

        // Merge with existing pending settlements
        const pendingSettlements = settlements.filter(
          (s) => s.status === 'pending'
        )
        const completedSettlements = settlements.filter(
          (s) => s.status === 'completed'
        )

        // Create pending settlements for any new debts
        const existingPending = new Set(
          pendingSettlements.map((s) => `${s.fromUserId}-${s.toUserId}`)
        )

        const newPending = optimized.filter(
          (s) => !existingPending.has(`${s.fromUserId}-${s.toUserId}`)
        )

        const allSettlements = [
          ...pendingSettlements.map((s) => ({
            id: s.id,
            groupId: s.groupId,
            fromUserId: s.fromUserId,
            fromUserName: s.fromUserName,
            toUserId: s.toUserId,
            toUserName: s.toUserName,
            amount: s.amount,
            txHash: s.txHash,
            status: s.status,
            createdAt: s.createdAt,
          })),
          ...newPending.map((s) => ({
            id: randomUUID(),
            groupId,
            fromUserId: s.fromUserId,
            fromUserName: s.fromUserName,
            toUserId: s.toUserId,
            toUserName: s.toUserName,
            amount: s.amount,
            status: 'pending' as const,
            createdAt: new Date().toISOString(),
          })),
          ...completedSettlements.map((s) => ({
            id: s.id,
            groupId: s.groupId,
            fromUserId: s.fromUserId,
            fromUserName: s.fromUserName,
            toUserId: s.toUserId,
            toUserName: s.toUserName,
            amount: s.amount,
            txHash: s.txHash,
            status: s.status,
            createdAt: s.createdAt,
          })),
        ]

        return json(allSettlements)
      }

      case 'POST': {
        if (!telegramUser && !isDev) {
          return unauthorized()
        }

        const body = JSON.parse(event.body || '{}')
        const { fromUserId, toUserId, amount, txHash } = body

        if (!fromUserId || !toUserId || !amount || !txHash) {
          return error('Missing required fields')
        }

        // Get member names
        const fromMember = members.find((m) => m.id === fromUserId)
        const toMember = members.find((m) => m.id === toUserId)

        if (!fromMember || !toMember) {
          return error('Invalid user IDs')
        }

        const id = randomUUID()
        const now = new Date().toISOString()

        const settlement = await createSettlement({
          id,
          groupId,
          fromUserId,
          fromUserName: fromMember.name,
          toUserId,
          toUserName: toMember.name,
          amount: Number(amount),
          txHash,
          status: 'completed',
          createdAt: now,
        })

        return json(settlement, 201)
      }

      default:
        return error(`Method ${method} not allowed`, 405)
    }
  } catch (err) {
    console.error('Settlements handler error:', err)
    return error('Internal server error', 500)
  }
}
