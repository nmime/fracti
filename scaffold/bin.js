#!/usr/bin/env node

import * as p from '@clack/prompts'
import pc from 'picocolors'
import spawn from 'cross-spawn'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

const APP_YAML_PATH = new URL('../app.yaml', import.meta.url).pathname

async function main() {
  console.clear()

  p.intro(pc.bgCyan(pc.black(' Deploy Telegram Mini App on AWS serverless infrastructure ')))

  // Check prerequisites
  const checks = await p.group({
    node: () => checkCommand('node', '--version', 'Node.js'),
    pnpm: () => checkCommand('pnpm', '--version', 'pnpm'),
    aws: () => checkCommand('aws', '--version', 'AWS CLI'),
    cdk: () => checkCommand('cdk', '--version', 'AWS CDK'),
  }, {
    onCancel: () => {
      p.cancel('Setup cancelled.')
      process.exit(0)
    }
  })

  const allPassed = Object.values(checks).every(Boolean)
  if (!allPassed) {
    p.outro(pc.red('Please install missing prerequisites before continuing.'))
    process.exit(1)
  }

  p.note('All prerequisites are installed!', 'Prerequisites Check')

  // Load existing config
  let existingConfig = {}
  if (existsSync(APP_YAML_PATH)) {
    try {
      existingConfig = parseYaml(readFileSync(APP_YAML_PATH, 'utf-8'))
    } catch {
      // Ignore parse errors
    }
  }

  // Collect configuration
  const config = await p.group({
    stackName: () => p.text({
      message: 'What is your application name?',
      placeholder: 'fracti',
      initialValue: existingConfig.app?.stack_name || 'fracti',
      validate: (value) => {
        if (!value) return 'Application name is required'
        if (!/^[a-z][a-z0-9-]*$/.test(value)) {
          return 'Name must start with a letter and contain only lowercase letters, numbers, and hyphens'
        }
      }
    }),

    region: () => p.select({
      message: 'Select AWS region',
      initialValue: existingConfig.aws?.region || 'us-east-1',
      options: [
        { value: 'us-east-1', label: 'US East (N. Virginia)' },
        { value: 'us-west-2', label: 'US West (Oregon)' },
        { value: 'eu-west-1', label: 'Europe (Ireland)' },
        { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
        { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
        { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
      ]
    }),

    botToken: () => p.text({
      message: 'Enter your Telegram Bot Token (from @BotFather)',
      placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      validate: (value) => {
        if (!value) return 'Bot token is required'
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(value)) {
          return 'Invalid bot token format'
        }
      }
    }),

    bedrockModel: () => p.select({
      message: 'Select AI model for expense parsing',
      initialValue: existingConfig.bedrock?.model || 'anthropic.claude-sonnet-4-20250514-v1:0',
      options: [
        { value: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (Recommended)' },
        { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2' },
        { value: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro (Cost-effective)' },
        { value: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
      ]
    }),

    enableWaf: () => p.confirm({
      message: 'Enable WAF protection for CloudFront?',
      initialValue: existingConfig.cdn?.waf?.enabled ?? true,
    }),

    geoBlock: () => p.multiselect({
      message: 'Block access from countries (optional)',
      options: [
        { value: 'IQ', label: 'Iraq' },
        { value: 'IR', label: 'Iran' },
        { value: 'KP', label: 'North Korea' },
        { value: 'CN', label: 'China' },
        { value: 'RU', label: 'Russia' },
      ],
      initialValues: existingConfig.cdn?.geo_restrictions?.block || [],
      required: false,
    }),
  }, {
    onCancel: () => {
      p.cancel('Setup cancelled.')
      process.exit(0)
    }
  })

  // Verify bot token
  const s = p.spinner()
  s.start('Verifying Telegram bot token...')

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`)
    const data = await response.json()

    if (!data.ok) {
      s.stop('Bot token verification failed')
      p.cancel('Invalid bot token. Please check and try again.')
      process.exit(1)
    }

    s.stop(`Bot verified: @${data.result.username}`)
  } catch {
    s.stop('Bot token verification failed')
    p.cancel('Could not verify bot token. Check your internet connection.')
    process.exit(1)
  }

  // Show summary
  const summary = `
${pc.bold('Application:')} ${config.stackName}
${pc.bold('AWS Region:')} ${config.region}
${pc.bold('AI Model:')} ${config.bedrockModel.split(':')[0]}
${pc.bold('WAF Protection:')} ${config.enableWaf ? 'Enabled' : 'Disabled'}
${pc.bold('Geo Restrictions:')} ${config.geoBlock.length > 0 ? config.geoBlock.join(', ') : 'None'}
`

  p.note(summary, 'Configuration Summary')

  const proceed = await p.confirm({
    message: 'Proceed with deployment to your AWS account?',
  })

  if (!proceed) {
    p.cancel('Deployment cancelled.')
    process.exit(0)
  }

  // Update app.yaml
  const appYaml = {
    app: {
      stack_name: config.stackName,
      frontend: '@gui/react',
    },
    aws: {
      region: config.region,
    },
    cdn: {
      waf: {
        enabled: config.enableWaf,
        ddos_protection: config.enableWaf,
      },
      geo_restrictions: {
        block: config.geoBlock,
      },
    },
    bedrock: {
      model: config.bedrockModel,
    },
    bot: {
      enabled: true,
      webhook_protection: {
        type: 'cff',
        telegram_ip_filter: true,
        secret_token: true,
      },
    },
  }

  writeFileSync(APP_YAML_PATH, stringifyYaml(appYaml))
  p.log.success('Updated app.yaml configuration')

  // Create .env file for bot token
  const envContent = `TELEGRAM_BOT_TOKEN=${config.botToken}\n`
  writeFileSync(new URL('../.env', import.meta.url).pathname, envContent)
  p.log.success('Created .env file with bot token')

  // Run deployment
  p.log.step('Installing dependencies...')
  const installResult = spawn.sync('pnpm', ['install'], { stdio: 'inherit' })
  if (installResult.status !== 0) {
    p.cancel('Failed to install dependencies')
    process.exit(1)
  }

  p.log.step('Building packages...')
  const buildResult = spawn.sync('pnpm', ['build'], { stdio: 'inherit' })
  if (buildResult.status !== 0) {
    p.cancel('Failed to build packages')
    process.exit(1)
  }

  p.log.step('Bootstrapping CDK...')
  const bootstrapResult = spawn.sync('pnpm', ['cdk:bootstrap'], { stdio: 'inherit' })
  if (bootstrapResult.status !== 0) {
    p.log.warn('CDK bootstrap may have already been done')
  }

  p.log.step('Deploying to AWS...')
  const deployResult = spawn.sync('pnpm', ['cdk:deploy'], { stdio: 'inherit' })
  if (deployResult.status !== 0) {
    p.cancel('Deployment failed')
    process.exit(1)
  }

  p.outro(pc.green('🎉 Deployment successful! Your Telegram Mini App is live.'))
}

async function checkCommand(cmd, args, name) {
  try {
    const result = spawn.sync(cmd, [args], { encoding: 'utf-8' })
    if (result.status === 0) {
      p.log.success(`${name} is installed`)
      return true
    }
  } catch {
    // Command not found
  }
  p.log.error(`${name} is not installed`)
  return false
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
