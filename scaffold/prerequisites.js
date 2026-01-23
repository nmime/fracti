#!/usr/bin/env node
/**
 * Prerequisites validation for Fracti deployment
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import spawn from 'cross-spawn'

const PREREQUISITES = [
  {
    name: 'Node.js',
    command: 'node',
    args: ['--version'],
    minVersion: '20.0.0',
    installUrl: 'https://nodejs.org/',
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    minVersion: '9.0.0',
    installUrl: 'https://pnpm.io/installation',
  },
  {
    name: 'AWS CLI',
    command: 'aws',
    args: ['--version'],
    minVersion: '2.0.0',
    installUrl: 'https://aws.amazon.com/cli/',
  },
  {
    name: 'AWS CDK',
    command: 'cdk',
    args: ['--version'],
    minVersion: '2.100.0',
    installUrl: 'https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html',
  },
]

export async function checkPrerequisites() {
  p.log.step('Checking prerequisites...')

  const results = []
  const missing = []

  for (const prereq of PREREQUISITES) {
    const result = await checkCommand(prereq)
    results.push(result)

    if (result.installed) {
      p.log.success(`${prereq.name} ${pc.dim(`v${result.version}`)}`)
    } else {
      p.log.error(`${prereq.name} is not installed`)
      missing.push(prereq)
    }
  }

  // Check AWS credentials
  const awsCredentials = await checkAwsCredentials()
  if (awsCredentials.valid) {
    p.log.success(`AWS credentials configured ${pc.dim(`(${awsCredentials.account})`)}`)
  } else {
    p.log.error('AWS credentials not configured')
    missing.push({
      name: 'AWS credentials',
      installUrl: 'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html',
    })
  }

  if (missing.length > 0) {
    p.log.warn('\nMissing prerequisites:')
    for (const prereq of missing) {
      console.log(`  ${pc.yellow('•')} ${prereq.name}: ${pc.cyan(prereq.installUrl)}`)
    }
    return { success: false, missing }
  }

  p.log.success('\nAll prerequisites satisfied!')
  return { success: true, results }
}

async function checkCommand(prereq) {
  try {
    const result = spawn.sync(prereq.command, prereq.args, {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.status === 0) {
      const output = result.stdout || result.stderr || ''
      const version = extractVersion(output)
      return {
        installed: true,
        version,
        meetsMinimum: compareVersions(version, prereq.minVersion) >= 0,
      }
    }
  } catch {
    // Command not found
  }

  return { installed: false }
}

async function checkAwsCredentials() {
  try {
    const result = spawn.sync('aws', ['sts', 'get-caller-identity', '--output', 'json'], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.status === 0) {
      const identity = JSON.parse(result.stdout)
      return {
        valid: true,
        account: identity.Account,
        arn: identity.Arn,
      }
    }
  } catch {
    // Credentials not configured
  }

  return { valid: false }
}

function extractVersion(output) {
  // Match various version formats: v20.0.0, 2.100.0, etc.
  const match = output.match(/v?(\d+\.\d+\.\d+)/)
  return match ? match[1] : '0.0.0'
}

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

export default { checkPrerequisites }
