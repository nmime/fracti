/**
 * Bot main exports
 */

// Bot instance and handlers
export { handleBotUpdate, startBot } from './bot';
export type { BotResponse, BotUpdateHandler } from './bot';
export { handler } from './lambda';

// Config
export * from './config';

// Services
export * from './services';

// Integrations
export * from './integrations';

// I18n
export * from './i18n';

// Handlers
export { setupBotHandlers } from './handlers';
