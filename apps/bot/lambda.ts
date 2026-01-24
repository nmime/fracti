import type { LambdaFunctionURLHandler } from 'aws-lambda'
import { handleBotUpdate } from './bot'

export const handler: LambdaFunctionURLHandler = async (event, context) => {
  // Don't wait for empty event loop - critical for grammY
  context.callbackWaitsForEmptyEventLoop = false

  try {
    console.log('Telegram: Incoming update', { bodyLength: event.body?.length || 0 })

    if (!event.body) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      }
    }

    const update = JSON.parse(event.body)
    await handleBotUpdate(update)

    // Always return 200 OK - message is sent via direct API call
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  } catch (error) {
    console.error('Telegram Bot Lambda: Error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Return 200 to prevent Telegram retries
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  }
}
