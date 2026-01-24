// Bot instance and handlers
export { bot, handleBotUpdate, startBot } from './bot'
export { handler } from './lambda'

// AI module
export * from './ai'

// Middleware (S3 & Telegram utilities)
export * from './middleware'

// I18n (translations)
export * from './i18n'

// Lib (config & helpers)
export * from './lib'

// Handlers (for extension)
export { setupBotHandlers } from './handlers'
