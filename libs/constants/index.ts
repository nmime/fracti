import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// Find and load app.yaml from the monorepo root
function loadAppConfig() {
  let configPath = path.resolve(process.cwd(), 'app.yaml');

  // Try to find app.yaml by going up directories
  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const tryPath = path.join(currentDir, 'app.yaml');
    if (fs.existsSync(tryPath)) {
      configPath = tryPath;
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  if (!fs.existsSync(configPath)) {
    // Return defaults if not found
    return {
      app: { stack_name: 'fracti', frontend: '@fracti/web' },
      aws: { region: 'us-east-1' },
      cdn: { waf: { enabled: true, ddos_protection: true }, geo_restrictions: { block: [] } },
      bedrock: { model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' },
      bot: { enabled: true, webhook_protection: { type: 'cff', telegram_ip_filter: true, secret_token: true } },
    };
  }

  const content = fs.readFileSync(configPath, 'utf-8');

  return yaml.parse(content);
}

const appConfig = loadAppConfig();

// Application constants derived from app.yaml
const $ = {
  app: {
    name: appConfig.app?.stack_name ?? 'fracti',
    frontend: appConfig.app?.frontend ?? '@fracti/web',
  },

  aws: {
    region: appConfig.aws?.region ?? 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID ?? '',
  },

  cdn: {
    waf: {
      enabled: appConfig.cdn?.waf?.enabled ?? true,
      ddosProtection: appConfig.cdn?.waf?.ddos_protection ?? true,
    },
    geoRestrictions: {
      block: appConfig.cdn?.geo_restrictions?.block ?? [],
    },
  },

  bedrock: {
    model: appConfig.bedrock?.model ?? 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    region: appConfig.bedrock?.region ?? appConfig.aws?.region ?? 'us-east-1',
  },

  bot: {
    enabled: appConfig.bot?.enabled ?? true,
    webhookProtection: {
      type: appConfig.bot?.webhook_protection?.type ?? 'cff',
      telegramIpFilter: appConfig.bot?.webhook_protection?.telegram_ip_filter ?? true,
      secretToken: appConfig.bot?.webhook_protection?.secret_token ?? true,
    },
  },

  // Artifact paths for CDK
  // GUI basepath: '/app' for AWS Lambda, '/' for Docker
  artifacts: {
    lambda: {
      bot: {
        basepath: '/bot',
      },
      gui: {
        basepath: process.env.VITE_BASE_PATH ?? '/app',
      },
    },
    s3: {
      avatars: 'avatars',
    },
  },

  // DynamoDB table configuration
  dynamodb: {
    tableName: `${appConfig.app?.stack_name ?? 'fracti'}-table`,
    gsi: {
      gsi1: 'GSI1',
      gsi2: 'GSI2',
      gsi3: 'GSI3',
    },
  },

  // Environment variable names
  env: {
    TABLE_NAME: 'TABLE_NAME',
    S3_BUCKET_NAME: 'S3_BUCKET_NAME',
    TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
    MINI_APP_URL: 'MINI_APP_URL', // t.me deeplink (e.g., https://t.me/FractiBot/app)
    APP_URL: 'APP_URL', // CloudFront/domain URL (e.g., https://fracti.app)
    BEDROCK_MODEL_ID: 'BEDROCK_MODEL_ID',
    AWS_REGION: 'AWS_REGION',
  },
} as const;

export default $;
export { $ };
export type AppConfig = typeof $;
