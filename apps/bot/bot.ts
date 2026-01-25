import type { Update } from 'grammy/types'
import type { PollingOptions } from 'grammy'
import { Bot } from 'grammy'
import { getBotToken, BOT_INFO } from './config'
import { setupBotHandlers } from './handlers'

// Custom fetch that removes AbortSignal to fix Lambda compatibility issue
const originalFetch = globalThis.fetch
const patchedFetch: typeof fetch = (input, init) => {
  if (init?.signal) {
    const { signal, ...rest } = init
    return originalFetch(input, rest)
  }
  return originalFetch(input, init)
}

export type BotUpdateHandler = (update: Update) => Promise<string>

export type BotResponse =
  | {
      ok: true
      id: number
      body: string
    }
  | {
      ok: false
      error: string
    }

async function createBot() {
  const bot = new Bot(getBotToken(), {
    botInfo: BOT_INFO,
    client: {
      // Use custom fetch to avoid AbortSignal issues on Lambda
      fetch: patchedFetch,
    },
  })
  setupBotHandlers(bot)
  return bot
}

function createLazyBot() {
  const lazyBot = Object.create(null) as {
    handler: Promise<BotUpdateHandler>
  }

  Object.defineProperty(lazyBot, 'handler', {
    enumerable: false,
    configurable: true,
    get: async () => {
      const bot = await createBot()

      const handler: BotUpdateHandler = async function (update) {
        // Use direct API calls - patched fetch handles AbortSignal issue
        await bot.handleUpdate(update)
        return ''
      }

      Object.defineProperty(lazyBot, 'handler', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: handler,
      })

      return handler
    },
  })

  return lazyBot
}

const bot = createLazyBot()

export async function handleBotUpdate(
  update: Update & { update_id?: string | number }
): Promise<BotResponse> {
  try {
    if (update && update.update_id) {
      const processor = await bot.handler
      await processor(update)

      console.log('Telegram Bot: Update processed successfully')

      return {
        ok: true,
        id: typeof update.update_id === 'number' ? update.update_id : parseInt(update.update_id, 10),
        body: '',
      }
    } else {
      return {
        ok: false,
        error: 'Unprocessable Entity',
      }
    }
  } catch (err) {
    console.error('Telegram Bot: error during update processing', { err })

    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function startBot(opt?: PollingOptions) {
  async function launchBot() {
    const bot = await createBot()
    return bot.start(opt)
  }

  launchBot().then(
    () => console.log('Done.'),
    console.error
  )
}
