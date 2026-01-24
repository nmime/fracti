import type { Bot } from 'grammy'
import { registerCommandHandlers } from './commands'
import { registerMessageHandlers } from './messages'
import { registerInlineHandlers } from './inline'

export function setupBotHandlers(bot: Bot): void {
  registerCommandHandlers(bot)
  registerMessageHandlers(bot)
  registerInlineHandlers(bot)
}

export { registerCommandHandlers } from './commands'
export { registerMessageHandlers } from './messages'
export { registerInlineHandlers } from './inline'
