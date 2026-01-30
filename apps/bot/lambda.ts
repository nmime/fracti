import { handleBotUpdate } from './bot';
import type { LambdaFunctionURLHandler } from 'aws-lambda';

export const handler: LambdaFunctionURLHandler = async (event, context) => {
  // Don't wait for empty event loop - critical for grammY
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    console.log('Telegram: Incoming update', { bodyLength: event.body?.length || 0 });

    if (!event.body) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    }

    // Reject payloads larger than 100KB to prevent DoS attacks
    // Telegram webhook payloads are typically <10KB
    const MAX_BODY_SIZE = 100 * 1024; // 100KB
    if (event.body.length > MAX_BODY_SIZE) {
      console.warn('Telegram Bot Lambda: Payload too large', {
        size: event.body.length,
        limit: MAX_BODY_SIZE,
      });

      // Return 200 to prevent Telegram retries
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      };
    }

    const update = JSON.parse(event.body);
    await handleBotUpdate(update);

    // Always return 200 OK - message is sent via direct API call
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error('Telegram Bot Lambda: Error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 200 to prevent Telegram retries
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  }
};
