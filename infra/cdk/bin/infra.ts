#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { FractiApp } from '../lib/stacks/app'
import $ from '@core/constants'

const app = new cdk.App()

// Get environment from context or default
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev'
const region = $.aws.region || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT

// Environment configuration
const env: cdk.Environment = {
  account,
  region,
}

// Create the Fracti application with all stacks
new FractiApp(app, `Fracti-${stage}`, {
  stage,
  env,
})

// Add global tags to all resources
cdk.Tags.of(app).add('Application', 'Fracti')
cdk.Tags.of(app).add('Environment', stage)
cdk.Tags.of(app).add('ManagedBy', 'CDK')

app.synth()
