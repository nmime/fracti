#!/usr/bin/env node
/**
 * Deployment orchestration for Fracti
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import spawn from 'cross-spawn'
import { existsSync } from 'fs'

export async function deploy(config) {
  const { stackName, region, stage } = config

  p.log.step('Starting deployment...')

  // Check if CDK is bootstrapped
  const bootstrapResult = await runCommand('pnpm', ['cdk', 'bootstrap', `aws://${process.env.AWS_ACCOUNT_ID || 'unknown'}/${region}`], {
    env: {
      ...process.env,
      AWS_REGION: region,
      STAGE: stage,
    }
  })

  if (!bootstrapResult.success) {
    p.log.warn('CDK bootstrap may have already been done or failed')
  }

  // Run CDK deploy
  p.log.step('Deploying CDK stacks...')

  const deployResult = await runCommand('pnpm', ['cdk', 'deploy', '--all', '--require-approval', 'never'], {
    env: {
      ...process.env,
      AWS_REGION: region,
      STAGE: stage,
    }
  })

  if (!deployResult.success) {
    throw new Error('CDK deployment failed')
  }

  p.log.success('Deployment completed successfully')

  return {
    success: true,
    outputs: deployResult.outputs,
  }
}

export async function destroy(config) {
  const { region, stage } = config

  const confirmed = await p.confirm({
    message: pc.red('Are you sure you want to destroy all resources? This cannot be undone.'),
    initialValue: false,
  })

  if (!confirmed) {
    p.cancel('Destroy cancelled')
    return { success: false }
  }

  p.log.step('Destroying CDK stacks...')

  const destroyResult = await runCommand('pnpm', ['cdk', 'destroy', '--all', '--force'], {
    env: {
      ...process.env,
      AWS_REGION: region,
      STAGE: stage,
    }
  })

  if (!destroyResult.success) {
    throw new Error('CDK destroy failed')
  }

  p.log.success('All resources destroyed')

  return { success: true }
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      ...options,
    })

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
      })
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        error,
      })
    })
  })
}

export default { deploy, destroy }
