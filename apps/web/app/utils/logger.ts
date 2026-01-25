/**
 * Structured logger for client-side logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const isProduction = import.meta.env.PROD
const isDevelopment = import.meta.env.DEV

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel: LogLevel = isProduction ? 'warn' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`
  if (context && Object.keys(context).length > 0) {
    formatted += ` ${JSON.stringify(context)}`
  }
  return formatted
}

function reportToMonitoring(_level: LogLevel, _message: string, _context?: LogContext, _error?: unknown): void {
  if (!isProduction) return
  // Placeholder for monitoring service integration
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.info(formatMessage('info', message, context))
    }
  },

  warn(message: string, context?: LogContext, error?: unknown): void {
    if (!shouldLog('warn')) return
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.warn(formatMessage('warn', message, context), error || '')
    }
    reportToMonitoring('warn', message, context, error)
  },

  error(message: string, context?: LogContext, error?: unknown): void {
    if (!shouldLog('error')) return
    if (isDevelopment) {
      // eslint-disable-next-line no-console
      console.error(formatMessage('error', message, context), error || '')
    }
    reportToMonitoring('error', message, context, error)
  },
}

export type Logger = typeof logger
