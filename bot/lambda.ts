import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda'
import { handleUpdate } from './bot'

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context
): Promise<APIGatewayProxyResultV2> {
  try {
    // Create a Request object from the Lambda event
    const body = event.body || ''
    const headers = new Headers()

    for (const [key, value] of Object.entries(event.headers || {})) {
      if (value) headers.set(key, value)
    }

    const request = new Request(
      `https://${event.requestContext.domainName}${event.rawPath}`,
      {
        method: event.requestContext.http.method,
        headers,
        body: event.requestContext.http.method !== 'GET' ? body : undefined,
      }
    )

    // Handle the update using Grammy's webhook callback
    const response = await handleUpdate(request)

    // Convert Response to Lambda response
    const responseBody = await response.text()

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
