import type { APIGatewayProxyResultV2 } from 'aws-lambda'

export function json<T>(data: T, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
    },
    body: JSON.stringify(data),
  }
}

export function error(
  message: string,
  statusCode = 400
): APIGatewayProxyResultV2 {
  return json({ error: message }, statusCode)
}

export function notFound(message = 'Not found'): APIGatewayProxyResultV2 {
  return error(message, 404)
}

export function unauthorized(
  message = 'Unauthorized'
): APIGatewayProxyResultV2 {
  return error(message, 401)
}

export function serverError(
  message = 'Internal server error'
): APIGatewayProxyResultV2 {
  return error(message, 500)
}
