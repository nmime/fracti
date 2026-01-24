/**
 * Development mode - run the bot with polling instead of webhooks
 */
import type { UserFromGetMe } from 'grammy/types'
import { startBot } from './bot'

console.log('Starting bot in development mode...')

startBot({
  onStart: (botInfo: UserFromGetMe) => {
    console.log(`Bot @${botInfo.username} started in polling mode`)
  },
})
