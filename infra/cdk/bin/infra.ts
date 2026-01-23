#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { FractiStack } from '../lib/stacks/app'

const app = new cdk.App()

// Get environment from context or default
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev'
const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT

new FractiStack(app, `fracti-${stage}`, {
  env: {
    account,
    region,
  },
  stage,
  description: 'Fracti - AI-powered expense splitting Telegram Mini App with TON settlements',
  tags: {
    Application: 'Fracti',
    Environment: stage,
    ManagedBy: 'CDK',
  },
})

app.synth()
