import { Bot } from 'grammy'
import type { Update } from 'grammy/types'
import { getBotToken, BOT_INFO } from './lib/config'
import { setupBotHandlers } from './handlers'

// Bot factory - creates and configures a new bot instance
function createBot(): Bot {
  const bot = new Bot(getBotToken(), { botInfo: BOT_INFO })
  setupBotHandlers(bot)
  return bot
}

// Lazy initialization for Lambda
type UpdateHandler = (update: Update) => Promise<void>
let cachedHandler: UpdateHandler | null = null

async function getHandler(): Promise<UpdateHandler> {
  if (!cachedHandler) {
    const bot = createBot()
    cachedHandler = (update: Update) => bot.handleUpdate(update)
  }
  return cachedHandler
}

// Export for Lambda handler
export async function handleBotUpdate(update: Update): Promise<{ ok: boolean }> {
  try {
    const handler = await getHandler()
    await handler(update)
    return { ok: true }
  } catch (error) {
    console.error('Bot update error:', error)
    return { ok: true } // Return ok to prevent Telegram retries
  }
}

// For local development polling
export function startBot(): void {
  const bot = createBot()
  bot.start({
    onStart: (info) => console.log(`Bot @${info.username} started`),
  })
}

// Exported for testing
export const bot = createBot()
