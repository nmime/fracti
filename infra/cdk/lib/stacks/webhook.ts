import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as crypto from 'crypto'
import { Construct } from 'constructs'

export interface WebhookStackProps extends cdk.StackProps {
  stage: string
  botToken?: string
}

// Telegram API IP ranges (as of 2024)
// https://core.telegram.org/bots/webhooks#the-short-version
const TELEGRAM_IP_RANGES = [
  '149.154.160.0/20',
  '91.108.4.0/22',
]

export class WebhookStack extends cdk.Stack {
  public readonly secretToken: string
  public readonly secretTokenMd5: string
  public readonly webhookValidationFunction: cloudfront.Function

  constructor(scope: Construct, id: string, props: WebhookStackProps) {
    super(scope, id, props)

    const { stage, botToken } = props

    // ============================================
    // Generate Webhook Secret Token
    // ============================================
    // Use bot token to generate a deterministic but secret token
    // In production, this should come from Secrets Manager
    const tokenSource = botToken || `fracti-${stage}-${Date.now()}`
    this.secretToken = crypto
      .createHash('sha256')
      .update(tokenSource)
      .digest('hex')
      .substring(0, 32)

    this.secretTokenMd5 = crypto
      .createHash('md5')
      .update(this.secretToken)
      .digest('hex')

    // ============================================
    // CloudFront Function for Webhook Validation
    // ============================================
    // This function validates incoming webhook requests from Telegram
    this.webhookValidationFunction = new cloudfront.Function(this, 'WebhookValidation', {
      functionName: `fracti-webhook-validation-${stage}`,
      code: cloudfront.FunctionCode.fromInline(`
// Telegram IP ranges for validation
var TELEGRAM_CIDRS = ${JSON.stringify(TELEGRAM_IP_RANGES)};

function ipInCidr(ip, cidr) {
  var parts = cidr.split('/');
  var baseIp = parts[0];
  var mask = parseInt(parts[1], 10);

  var ipNum = ipToNumber(ip);
  var baseNum = ipToNumber(baseIp);
  var maskNum = ~((1 << (32 - mask)) - 1) >>> 0;

  return (ipNum & maskNum) === (baseNum & maskNum);
}

function ipToNumber(ip) {
  var parts = ip.split('.');
  return ((parseInt(parts[0], 10) << 24) |
          (parseInt(parts[1], 10) << 16) |
          (parseInt(parts[2], 10) << 8) |
          parseInt(parts[3], 10)) >>> 0;
}

function handler(event) {
  var request = event.request;
  var clientIp = event.viewer.ip;

  // Only validate /bot/webhook path
  if (!request.uri.includes('/webhook')) {
    return request;
  }

  // Check if request comes from Telegram IP range
  var isTelegramIp = false;
  for (var i = 0; i < TELEGRAM_CIDRS.length; i++) {
    if (ipInCidr(clientIp, TELEGRAM_CIDRS[i])) {
      isTelegramIp = true;
      break;
    }
  }

  // In production, block non-Telegram IPs
  // For development, we allow all IPs but add a header
  if (!isTelegramIp) {
    request.headers['x-telegram-verified'] = { value: 'false' };
  } else {
    request.headers['x-telegram-verified'] = { value: 'true' };
  }

  // Validate X-Telegram-Bot-Api-Secret-Token header
  var secretToken = request.headers['x-telegram-bot-api-secret-token'];
  if (secretToken && secretToken.value === '${this.secretToken}') {
    request.headers['x-webhook-validated'] = { value: 'true' };
  } else {
    request.headers['x-webhook-validated'] = { value: 'false' };
  }

  return request;
}
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    })

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'WebhookSecretToken', {
      value: this.secretToken,
      description: 'Secret token for Telegram webhook validation',
    })

    new cdk.CfnOutput(this, 'TelegramIpRanges', {
      value: TELEGRAM_IP_RANGES.join(', '),
      description: 'Telegram API IP ranges for firewall rules',
    })
  }

  /**
   * Get the Telegram webhook URL format
   */
  public getWebhookUrl(cloudFrontDomain: string): string {
    return `https://${cloudFrontDomain}/bot/webhook`
  }
}
