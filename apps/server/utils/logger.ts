/**
 * Structured logger for server-side logging.
 * Uses JSON format in production for log aggregation services.
 * Uses human-readable format in development.
 */

import { isProduction } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = isProduction ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: isProduction ? undefined : error.stack,
      name: error.name,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const message = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);

  return {
    message,
    name: 'UnknownError',
  };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: context && Object.keys(context).length > 0 ? context : undefined,
    error: formatError(error),
  };
}

function output(entry: LogEntry): void {
  if (isProduction) {
    const jsonOutput = JSON.stringify(entry);
    if (entry.level === 'error') {
      process.stderr.write(`${jsonOutput}\n`);
    } else {
      process.stdout.write(`${jsonOutput}\n`);
    }
  } else {
    const prefix = {
      debug: '\x1b[36m[DEBUG]\x1b[0m',
      info: '\x1b[32m[INFO]\x1b[0m',
      warn: '\x1b[33m[WARN]\x1b[0m',
      error: '\x1b[31m[ERROR]\x1b[0m',
    }[entry.level];

    let msg = `${prefix} ${entry.message}`;
    if (entry.context) {
      msg += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      msg += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        msg += `\n  ${entry.error.stack}`;
      }
    }

    if (entry.level === 'error') {
      process.stderr.write(`${msg}\n`);
    } else {
      process.stdout.write(`${msg}\n`);
    }
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      output(createLogEntry('debug', message, context));
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      output(createLogEntry('info', message, context));
    }
  },

  warn(message: string, context?: Record<string, unknown>, error?: unknown): void {
    if (shouldLog('warn')) {
      output(createLogEntry('warn', message, context, error));
    }
  },

  error(message: string, context?: Record<string, unknown>, error?: unknown): void {
    if (shouldLog('error')) {
      output(createLogEntry('error', message, context, error));
    }
  },

  withError(level: LogLevel, message: string, error: unknown, context?: Record<string, unknown>): void {
    if (shouldLog(level)) {
      output(createLogEntry(level, message, context, error));
    }
  },
};

export type Logger = typeof logger;
