import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  TABLE_NAME: z.string().min(1, 'TABLE_NAME is required'),
  S3_BUCKET_NAME: z.string().min(1, 'S3_BUCKET_NAME is required'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  JWT_SECRET: z.string().optional(), // Falls back to TELEGRAM_BOT_TOKEN if not set
  BEDROCK_MODEL_ID: z.string().default('us.anthropic.claude-3-5-haiku-20241022-v1:0'),
  AWS_REGION: z.string().default('us-east-1'),
  ALLOWED_ORIGINS: z.string().default('https://t.me,https://web.telegram.org'),
  TONCENTER_API_KEY: z.string().optional(),
  TONCENTER_API_URL: z.string().default('https://toncenter.com/api/v2'),
  SKIP_TON_VERIFICATION: z.coerce.boolean().default(false),
  MINI_APP_URL: z.string().optional(),
  // Database endpoint - set to ScyllaDB Alternator URL to switch from DynamoDB
  DB_ENDPOINT: z.url().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(z.treeifyError(result.error));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const config = loadConfig();

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

export function getAllowedOrigins(): string[] {
  return config.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
