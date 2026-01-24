import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda'
import { handleUpdate } from './bot'

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> {
  // Don't wait for empty event loop - critical for grammY
  context.callbackWaitsForEmptyEventLoop = false

  console.log('Bot Lambda invoked', {
    path: event.rawPath,
    method: event.requestContext.http.method,
    hasBody: !!event.body,
    bodyLength: event.body?.length || 0,
  })

  try {
    // Create a Request object from the Lambda event
    const body = event.body || ''
    const headers = new Headers()

    for (const [key, value] of Object.entries(event.headers || {})) {
      if (value) headers.set(key, value)
    }

    const url = `https://${event.requestContext.domainName}${event.rawPath}`
    console.log('Creating request for URL:', url)

    const request = new Request(url, {
      method: event.requestContext.http.method,
      headers,
      body: event.requestContext.http.method !== 'GET' ? body : undefined,
    })

    console.log('Calling handleUpdate...')

    // Handle the update using Grammy's webhook callback
    const response = await handleUpdate(request)

    console.log('handleUpdate returned, status:', response.status)

    // Convert Response to Lambda response
    const responseBody = await response.text()

    console.log('Response body length:', responseBody.length)

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    }
  } catch (error) {
    console.error('Bot webhook error:', error)

    // Always return 200 to prevent Telegram from retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    }
  }
}
