import { Bot } from 'grammy';
import { getBotToken, BOT_INFO } from './config';
import { setupBotHandlers } from './handlers';
import type { PollingOptions } from 'grammy';
import type { Update } from 'grammy/types';

// Custom fetch that removes AbortSignal to fix Lambda compatibility issue
const originalFetch = globalThis.fetch;
const patchedFetch: typeof fetch = (input, init) => {
  if (init?.signal) {
    const { signal: _signal, ...rest } = init;

    return originalFetch(input, rest);
  }

  return originalFetch(input, init);
};

export type BotUpdateHandler = (update: Update) => Promise<string>;

export type BotResponse =
  | {
      ok: true;
      id: number;
      body: string;
    }
  | {
      ok: false;
      error: string;
    };

async function createBot(usePatchedFetch = true) {
  const bot = new Bot(getBotToken(), {
    botInfo: BOT_INFO,
    // Only use patched fetch for Lambda (webhook mode), not for polling
    ...(usePatchedFetch && {
      client: {
        fetch: patchedFetch,
      },
    }),
  });

  setupBotHandlers(bot);

  return bot;
}

function createLazyBot() {
  const lazyBot = Object.create(null) as {
    handler: Promise<BotUpdateHandler>;
  };

  Object.defineProperty(lazyBot, 'handler', {
    enumerable: false,
    configurable: true,
    get: async () => {
      const bot = await createBot();

      const handler: BotUpdateHandler = async function (update) {
        // Use direct API calls - patched fetch handles AbortSignal issue
        await bot.handleUpdate(update);

        return '';
      };

      Object.defineProperty(lazyBot, 'handler', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: handler,
      });

      return handler;
    },
  });

  return lazyBot;
}

const bot = createLazyBot();

export async function handleBotUpdate(update: Update & { update_id?: string | number }): Promise<BotResponse> {
  try {
    if (update && update.update_id) {
      const processor = await bot.handler;
      await processor(update);

      // eslint-disable-next-line no-console
      console.info('Telegram Bot: Update processed successfully');

      return {
        ok: true,
        id: typeof update.update_id === 'number' ? update.update_id : parseInt(update.update_id, 10),
        body: '',
      };
    } else {
      return {
        ok: false,
        error: 'Unprocessable Entity',
      };
    }
  } catch (err) {
    console.error('Telegram Bot: error during update processing', { err });

    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function startBot(opt?: PollingOptions) {
  async function launchBot() {
    // Use normal fetch for polling mode (not patched fetch which breaks long-polling)
    const bot = await createBot(false);

    return bot.start(opt);
  }

  launchBot().then(() => {
    // eslint-disable-next-line no-console
    console.info('Done.');
  }, console.error);
}
