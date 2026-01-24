#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag'
import { FractiApp } from '../lib/stacks/app'
import $ from '@core/constants'

const app = new cdk.App()

// Enable CDK Nag for security compliance checks
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

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
const fractiApp = new FractiApp(app, `Fracti-${stage}`, {
  stage,
  env,
})

// Add CDK Nag suppressions for known acceptable patterns
NagSuppressions.addStackSuppressions(fractiApp.dynamoDbStack, [
  { id: 'AwsSolutions-DDB3', reason: 'Point-in-time recovery is enabled conditionally for production only' },
])

NagSuppressions.addStackSuppressions(fractiApp.backendStack, [
  { id: 'AwsSolutions-S1', reason: 'Access logging not required for avatar bucket - public read content' },
  { id: 'AwsSolutions-S2', reason: 'Avatar bucket intentionally allows public read for profile images' },
  { id: 'AwsSolutions-S10', reason: 'Avatar bucket serves static images over HTTPS via CloudFront' },
  { id: 'AwsSolutions-IAM4', reason: 'AWS managed policies acceptable for Lambda basic execution' },
  { id: 'AwsSolutions-IAM5', reason: 'Wildcard permissions required for DynamoDB index operations' },
  { id: 'AwsSolutions-L1', reason: 'Using latest Node.js 22.x runtime' },
])

NagSuppressions.addStackSuppressions(fractiApp.apiStack, [
  { id: 'AwsSolutions-APIG1', reason: 'Access logging configured at CloudFront level' },
  { id: 'AwsSolutions-APIG4', reason: 'Authorization handled at application level via Telegram init data' },
  { id: 'AwsSolutions-COG4', reason: 'Using Telegram authentication instead of Cognito' },
])

NagSuppressions.addStackSuppressions(fractiApp.cdnStack, [
  { id: 'AwsSolutions-CFR1', reason: 'Geo restrictions configured via WAF rules' },
  { id: 'AwsSolutions-CFR2', reason: 'WAF is attached to CloudFront distribution' },
  { id: 'AwsSolutions-CFR3', reason: 'Access logging configured at API Gateway level' },
  { id: 'AwsSolutions-CFR4', reason: 'Using TLS 1.2+ with CloudFront managed policies' },
])

// Add global tags to all resources
cdk.Tags.of(app).add('Application', 'Fracti')
cdk.Tags.of(app).add('Environment', stage)
cdk.Tags.of(app).add('ManagedBy', 'CDK')

app.synth()
