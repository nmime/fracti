/**
 * Helper utilities for Fracti scaffold
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import * as path from 'path';

/**
 * Load app.yaml configuration
 */
export function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return parseYaml(content) || {};
  } catch {
    return {};
  }
}

/**
 * Save app.yaml configuration
 */
export function saveConfig(configPath, config) {
  const content = stringifyYaml(config, {
    indent: 2,
    lineWidth: 0,
  });
  writeFileSync(configPath, content);
}

/**
 * Load .env file
 */
export function loadEnv(envPath) {
  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key) {
      env[key] = valueParts.join('=');
    }
  }

  return env;
}

/**
 * Save .env file
 */
export function saveEnv(envPath, env) {
  const lines = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  writeFileSync(envPath, lines + '\n');
}

/**
 * Validate Telegram bot token format
 */
export function isValidBotToken(token) {
  return /^\d+:[A-Za-z0-9_-]+$/.test(token);
}

/**
 * Verify bot token with Telegram API
 */
export async function verifyBotToken(token) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return {
        valid: true,
        bot: data.result,
      };
    }

    return {
      valid: false,
      error: data.description,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Format duration for display
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get project root directory
 */
export function getProjectRoot() {
  let dir = process.cwd();

  while (dir !== '/') {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    if (existsSync(path.join(dir, 'package.json'))) {
      const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      if (pkg.name === 'fracti') {
        return dir;
      }
    }
    dir = path.dirname(dir);
  }

  return process.cwd();
}

export default {
  loadConfig,
  saveConfig,
  loadEnv,
  saveEnv,
  isValidBotToken,
  verifyBotToken,
  formatDuration,
  getProjectRoot,
};
