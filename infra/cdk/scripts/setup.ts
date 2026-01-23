#!/usr/bin/env npx ts-node
/**
 * Post-deployment setup script for Fracti
 *
 * This script:
 * 1. Validates the Telegram bot token
 * 2. Registers the webhook URL with Telegram
 * 3. Configures the bot menu button
 * 4. Stores secrets in SSM Parameter Store
 */

import * as crypto from 'crypto'

interface BotInfo {
  id: number
  is_bot: boolean
  first_name: string
  username: string
  can_join_groups: boolean
  can_read_all_group_messages: boolean
  supports_inline_queries: boolean
}

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
}

interface SetupConfig {
  botToken: string
  webhookUrl: string
  miniAppUrl: string
  stage: string
}

async function telegramApi<T>(
  token: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const url = `https://api.telegram.org/bot${token}/${method}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: params ? JSON.stringify(params) : undefined,
  })

  const data = await response.json()

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`)
  }

  return data.result as T
}

async function validateBotToken(token: string): Promise<BotInfo> {
  console.log('Validating bot token...')
  const botInfo = await telegramApi<BotInfo>(token, 'getMe')
  console.log(`Bot validated: @${botInfo.username} (ID: ${botInfo.id})`)
  return botInfo
}

async function getWebhookInfo(token: string): Promise<WebhookInfo> {
  return await telegramApi<WebhookInfo>(token, 'getWebhookInfo')
}

async function setWebhook(
  token: string,
  url: string,
  secretToken: string
): Promise<boolean> {
  console.log(`Setting webhook URL: ${url}`)

  const result = await telegramApi<boolean>(token, 'setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query', 'inline_query'],
    drop_pending_updates: true,
  })

  if (result) {
    console.log('Webhook registered successfully')
  }

  return result
}

async function setMenuButton(
  token: string,
  miniAppUrl: string
): Promise<boolean> {
  console.log(`Setting menu button to: ${miniAppUrl}`)

  const result = await telegramApi<boolean>(token, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Open Fracti',
      web_app: {
        url: miniAppUrl,
      },
    },
  })

  if (result) {
    console.log('Menu button configured successfully')
  }

  return result
}

async function setBotCommands(token: string): Promise<boolean> {
  console.log('Setting bot commands...')

  const commands = [
    { command: 'start', description: 'Start using Fracti' },
    { command: 'help', description: 'Show help and usage info' },
    { command: 'balance', description: 'View your current balance' },
    { command: 'expenses', description: 'List recent expenses' },
    { command: 'settle', description: 'Settle debts with TON' },
    { command: 'add', description: 'Add a new expense' },
  ]

  const result = await telegramApi<boolean>(token, 'setMyCommands', {
    commands,
  })

  if (result) {
    console.log(`Set ${commands.length} bot commands`)
  }

  return result
}

function generateSecretToken(botToken: string): string {
  return crypto
    .createHash('sha256')
    .update(botToken + Date.now().toString())
    .digest('hex')
    .substring(0, 32)
}

async function setup(config: SetupConfig): Promise<void> {
  const { botToken, webhookUrl, miniAppUrl, stage } = config

  console.log('\n=== Fracti Post-Deployment Setup ===\n')
  console.log(`Stage: ${stage}`)

  try {
    // 1. Validate bot token
    const botInfo = await validateBotToken(botToken)

    // 2. Check current webhook status
    const currentWebhook = await getWebhookInfo(botToken)
    if (currentWebhook.url) {
      console.log(`Current webhook: ${currentWebhook.url}`)
      console.log(`Pending updates: ${currentWebhook.pending_update_count}`)
    }

    // 3. Generate and set webhook with secret token
    const secretToken = generateSecretToken(botToken)
    await setWebhook(botToken, webhookUrl, secretToken)

    // 4. Configure menu button
    await setMenuButton(botToken, miniAppUrl)

    // 5. Set bot commands
    await setBotCommands(botToken)

    // 6. Verify webhook is set
    const newWebhook = await getWebhookInfo(botToken)
    if (newWebhook.url === webhookUrl) {
      console.log('\nWebhook verification: PASSED')
    } else {
      console.warn('\nWebhook verification: FAILED - URL mismatch')
    }

    console.log('\n=== Setup Complete ===\n')
    console.log('Summary:')
    console.log(`  Bot: @${botInfo.username}`)
    console.log(`  Webhook: ${webhookUrl}`)
    console.log(`  Mini App: ${miniAppUrl}`)
    console.log(`  Secret Token: ${secretToken.substring(0, 8)}...`)
    console.log('\nStore this secret token in SSM Parameter Store:')
    console.log(`  aws ssm put-parameter --name "/fracti/${stage}/bot/webhook-secret" --value "${secretToken}" --overwrite`)

  } catch (error) {
    console.error('\nSetup failed:', error)
    process.exit(1)
  }
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  const botToken = process.env.TELEGRAM_BOT_TOKEN || args[0]
  const webhookUrl = process.env.WEBHOOK_URL || args[1]
  const miniAppUrl = process.env.MINI_APP_URL || args[2]
  const stage = process.env.STAGE || args[3] || 'dev'

  if (!botToken) {
    console.error('Error: TELEGRAM_BOT_TOKEN is required')
    console.error('Usage: npx ts-node setup.ts <BOT_TOKEN> <WEBHOOK_URL> <MINI_APP_URL> [STAGE]')
    console.error('  or set environment variables: TELEGRAM_BOT_TOKEN, WEBHOOK_URL, MINI_APP_URL')
    process.exit(1)
  }

  if (!webhookUrl) {
    console.error('Error: WEBHOOK_URL is required')
    process.exit(1)
  }

  if (!miniAppUrl) {
    console.error('Error: MINI_APP_URL is required')
    process.exit(1)
  }

  await setup({
    botToken,
    webhookUrl,
    miniAppUrl,
    stage,
  })
}

main()
