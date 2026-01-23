#!/usr/bin/env npx ts-node
/**
 * Deployment report generator for Fracti
 *
 * Generates a comprehensive report of the deployed infrastructure
 */

import * as fs from 'fs'
import * as path from 'path'

interface DeploymentInfo {
  stage: string
  region: string
  timestamp: string
  stacks: StackInfo[]
  outputs: Record<string, string>
  costs: CostEstimate
}

interface StackInfo {
  name: string
  status: string
  resources: number
  lastUpdated: string
}

interface CostEstimate {
  monthly: {
    lambda: number
    dynamodb: number
    cloudfront: number
    s3: number
    waf: number
    apiGateway: number
    total: number
  }
  notes: string[]
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function generateCostEstimate(stage: string): CostEstimate {
  // Rough estimates based on typical usage patterns
  const isProduction = stage === 'prod'

  const lambda = isProduction ? 5.0 : 0.5 // Based on 1M requests/month
  const dynamodb = isProduction ? 3.0 : 0.25 // On-demand pricing
  const cloudfront = isProduction ? 10.0 : 1.0 // 100GB transfer
  const s3 = isProduction ? 1.0 : 0.1 // Storage + requests
  const waf = isProduction ? 6.0 : 6.0 // WAF has minimum cost
  const apiGateway = isProduction ? 3.5 : 0.35 // 1M requests

  const total = lambda + dynamodb + cloudfront + s3 + waf + apiGateway

  return {
    monthly: {
      lambda,
      dynamodb,
      cloudfront,
      s3,
      waf,
      apiGateway,
      total,
    },
    notes: [
      'Estimates based on moderate usage (100K users, 1M requests/month)',
      'DynamoDB uses on-demand pricing - costs scale with usage',
      'WAF has a minimum monthly cost regardless of traffic',
      'CloudFront costs depend on data transfer and edge locations',
      'Actual costs may vary significantly based on usage patterns',
    ],
  }
}

function generateReport(info: DeploymentInfo): string {
  const divider = '═'.repeat(60)
  const thinDivider = '─'.repeat(60)

  let report = `
╔${divider}╗
║  FRACTI DEPLOYMENT REPORT
║  Generated: ${info.timestamp}
╚${divider}╝

┌${thinDivider}┐
│ ENVIRONMENT
├${thinDivider}┤
│ Stage:     ${info.stage}
│ Region:    ${info.region}
│ Stacks:    ${info.stacks.length}
└${thinDivider}┘

┌${thinDivider}┐
│ STACK STATUS
├${thinDivider}┤
`

  for (const stack of info.stacks) {
    report += `│ ${stack.name.padEnd(30)} ${stack.status.padEnd(15)} (${stack.resources} resources)\n`
  }

  report += `└${thinDivider}┘

┌${thinDivider}┐
│ KEY OUTPUTS
├${thinDivider}┤
`

  for (const [key, value] of Object.entries(info.outputs)) {
    const displayValue = value.length > 45 ? value.substring(0, 42) + '...' : value
    report += `│ ${key.padEnd(25)} ${displayValue}\n`
  }

  report += `└${thinDivider}┘

┌${thinDivider}┐
│ ESTIMATED MONTHLY COSTS (USD)
├${thinDivider}┤
│ Lambda:        ${formatCurrency(info.costs.monthly.lambda).padStart(10)}
│ DynamoDB:      ${formatCurrency(info.costs.monthly.dynamodb).padStart(10)}
│ CloudFront:    ${formatCurrency(info.costs.monthly.cloudfront).padStart(10)}
│ S3:            ${formatCurrency(info.costs.monthly.s3).padStart(10)}
│ WAF:           ${formatCurrency(info.costs.monthly.waf).padStart(10)}
│ API Gateway:   ${formatCurrency(info.costs.monthly.apiGateway).padStart(10)}
├${thinDivider}┤
│ TOTAL:         ${formatCurrency(info.costs.monthly.total).padStart(10)}
└${thinDivider}┘

NOTES:
`

  for (const note of info.costs.notes) {
    report += `  • ${note}\n`
  }

  report += `
┌${thinDivider}┐
│ NEXT STEPS
├${thinDivider}┤
│ 1. Run setup script to configure Telegram webhook:
│    pnpm run setup
│
│ 2. Test the bot by messaging @YourBot in Telegram
│
│ 3. Open the Mini App via the menu button
│
│ 4. Monitor logs in CloudWatch:
│    aws logs tail /aws/lambda/fracti-bot-${info.stage} --follow
│
│ 5. To destroy all resources:
│    pnpm run cdk:destroy
└${thinDivider}┘
`

  return report
}

async function main(): Promise<void> {
  const stage = process.env.STAGE || process.argv[2] || 'dev'
  const region = process.env.AWS_REGION || 'us-east-1'

  // In a real implementation, this would fetch from CloudFormation
  // For now, we generate a template report
  const info: DeploymentInfo = {
    stage,
    region,
    timestamp: new Date().toISOString(),
    stacks: [
      { name: `Fracti-Params-${stage}`, status: 'CREATE_COMPLETE', resources: 4, lastUpdated: new Date().toISOString() },
      { name: `Fracti-Logs-${stage}`, status: 'CREATE_COMPLETE', resources: 6, lastUpdated: new Date().toISOString() },
      { name: `Fracti-DynamoDB-${stage}`, status: 'CREATE_COMPLETE', resources: 4, lastUpdated: new Date().toISOString() },
      { name: `Fracti-WAF-${stage}`, status: 'CREATE_COMPLETE', resources: 1, lastUpdated: new Date().toISOString() },
      { name: `Fracti-Webhook-${stage}`, status: 'CREATE_COMPLETE', resources: 2, lastUpdated: new Date().toISOString() },
      { name: `Fracti-Backend-${stage}`, status: 'CREATE_COMPLETE', resources: 12, lastUpdated: new Date().toISOString() },
      { name: `Fracti-API-${stage}`, status: 'CREATE_COMPLETE', resources: 6, lastUpdated: new Date().toISOString() },
      { name: `Fracti-CDN-${stage}`, status: 'CREATE_COMPLETE', resources: 5, lastUpdated: new Date().toISOString() },
    ],
    outputs: {
      'CloudFrontDomain': 'dxxxxxxxxxx.cloudfront.net',
      'ApiEndpoint': `https://xxxxxxxxxx.execute-api.${region}.amazonaws.com`,
      'TableName': `fracti-${stage}`,
      'WebhookUrl': `https://dxxxxxxxxxx.cloudfront.net/bot/webhook`,
      'MiniAppUrl': 'https://dxxxxxxxxxx.cloudfront.net',
    },
    costs: generateCostEstimate(stage),
  }

  const report = generateReport(info)
  console.log(report)

  // Optionally save to file
  const reportPath = path.join(process.cwd(), `deployment-report-${stage}.txt`)
  fs.writeFileSync(reportPath, report)
  console.log(`\nReport saved to: ${reportPath}`)
}

main()
