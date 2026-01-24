import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { getAwsRegion, getBedrockModelId } from '../config'
import { claudeResponseSchema } from '../schemas'
import { withRetry } from '../utils/retry'
import { getCacheKey, getCachedResponse, cacheResponse } from '../utils/cache'
import type { InvokeClaudeTextOptions } from '../types'

/**
 * AWS Bedrock integration for Claude AI
 */

const client = new BedrockRuntimeClient({
  region: getAwsRegion(),
})

export async function invokeClaudeText(
  systemPrompt: string,
  userMessage: string,
  options: InvokeClaudeTextOptions = {}
): Promise<string> {
  const { skipCache = false } = options

  // Check cache first
  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage)
    const cached = getCachedResponse(cacheKey)
    if (cached) return cached
  }

  const result = await withRetry(async () => {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }

    const command = new InvokeModelCommand({
      modelId: getBedrockModelId(),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })

    const response = await client.send(command)
    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    const responseBody = claudeResponseSchema.parse(rawBody)

    const textContent = responseBody.content[0]
    if (!textContent?.text) {
      throw new Error('AI model returned empty response')
    }

    return textContent.text
  }, 'invokeClaudeText')

  // Cache the response
  if (!skipCache) {
    const cacheKey = getCacheKey(systemPrompt, userMessage)
    cacheResponse(cacheKey, result)
  }

  return result
}

export async function invokeClaudeVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType = 'image/jpeg'
): Promise<string> {
  return withRetry(async () => {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract all items from this receipt. Return the data in the specified JSON format.',
          },
        ],
      }],
    }

    const command = new InvokeModelCommand({
      modelId: getBedrockModelId(),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })

    const response = await client.send(command)
    const rawBody = JSON.parse(new TextDecoder().decode(response.body))
    const responseBody = claudeResponseSchema.parse(rawBody)

    const textContent = responseBody.content[0]
    if (!textContent?.text) {
      throw new Error('AI model returned empty response')
    }

    return textContent.text
  }, 'invokeClaudeVision')
}
