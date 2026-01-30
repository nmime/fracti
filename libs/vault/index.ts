import $ from '@libs/constants';

/**
 * Vault - Secure storage for secrets and configuration
 * In production, this would integrate with AWS Secrets Manager or Parameter Store
 */

export interface VaultSecrets {
  telegramBotToken: string;
  telegramBotTokenHash?: string;
  bedrockModelId: string;
  tonCenterApiKey?: string;
}

// Cache for secrets
let secretsCache: VaultSecrets | null = null;

/**
 * Get secrets from environment variables
 * In production, replace with AWS Secrets Manager
 */
export function getSecrets(): VaultSecrets {
  if (secretsCache) return secretsCache;

  secretsCache = {
    telegramBotToken: process.env[$.env.TELEGRAM_BOT_TOKEN] || '',
    bedrockModelId: process.env[$.env.BEDROCK_MODEL_ID] || $.bedrock.model,
    tonCenterApiKey: process.env.TONCENTER_API_KEY,
  };

  return secretsCache;
}

/**
 * Check if required secrets are available
 */
export function hasRequiredSecrets(): boolean {
  const secrets = getSecrets();

  return Boolean(secrets.telegramBotToken);
}

/**
 * Get a specific secret value
 */
export function getSecret<K extends keyof VaultSecrets>(key: K): VaultSecrets[K] {
  return getSecrets()[key];
}

/**
 * Mask a secret for logging (show first and last 4 characters)
 */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '********';

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * Clear the secrets cache (useful for testing)
 */
export function clearSecretsCache(): void {
  secretsCache = null;
}
