import type { LambdaFunctionURLHandler } from 'aws-lambda'
import { handleBotUpdate } from './bot'

export const handler: LambdaFunctionURLHandler = async (event, context) => {
  // Don't wait for empty event loop - critical for grammY
  context.callbackWaitsForEmptyEventLoop = false

  try {
    // Parse the update from request body
    if (!event.body) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      }
    }

    const update = JSON.parse(event.body)
    const result = await handleBotUpdate(update)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (error) {
    console.error('Bot webhook error:', error)

    // Always return 200 to prevent Telegram retries
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  }
}
