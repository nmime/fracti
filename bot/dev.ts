/**
 * Development mode - run the bot with polling instead of webhooks
 */
import { bot } from './bot'

console.log('Starting bot in development mode...')

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started in polling mode`)
  },
})

// Graceful shutdown
process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())
