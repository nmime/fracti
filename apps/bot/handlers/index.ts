import { registerCommandHandlers } from './commands';
import { registerInlineHandlers } from './inline';
import { registerMessageHandlers } from './messages';
import type { Bot } from 'grammy';

export function setupBotHandlers(bot: Bot): void {
  registerCommandHandlers(bot);
  registerMessageHandlers(bot);
  registerInlineHandlers(bot);
}

export { registerCommandHandlers } from './commands';
export { registerMessageHandlers } from './messages';
export { registerInlineHandlers } from './inline';
