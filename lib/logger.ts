// src/lib/logger.ts

// This module is intentionally runtime-neutral.
// It can be imported by:
// - Client Components
// - Server Components
// - Edge Runtime / middleware
// - Node.js server code
//
// IMPORTANT:
// Do NOT import node:fs, node:path, or use require/process.cwd() here.
// Next.js may bundle this module into the Edge/client runtime.

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    code?: string | number
  }
}

const PII_FIELDS = [
  'email',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'phone',
]

const MAX_CONTEXT_DEPTH = 10

/**
 * Redacts potentially sensitive fields from log context.
 *
 * This function is deliberately runtime-neutral so it can safely execute
 * in Browser, Edge, and Node.js environments.
 */
function redactPII(obj: unknown, depth = 0): unknown {
  if (depth > MAX_CONTEXT_DEPTH) {
    return '[MAX_DEPTH]'
  }

  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((value) => redactPII(value, depth + 1))
  }

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()

    if (PII_FIELDS.some((field) => lowerKey.includes(field))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactPII(value, depth + 1)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Convert an unknown error into a safe structured representation.
 */
function formatError(error: unknown): LogEntry['error'] {
  if (error instanceof Error) {
    const maybeCode = (error as { code?: unknown }).code

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code:
        typeof maybeCode === 'string' || typeof maybeCode === 'number'
          ? maybeCode
          : undefined,
    }
  }

  if (error !== undefined && error !== null) {
    return {
      name: 'UnknownError',
      message: String(error),
    }
  }

  return undefined
}

/**
 * Build the structured log entry.
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  if (context) {
    entry.context = redactPII(context) as LogContext
  }

  const formattedError = formatError(error)

  if (formattedError) {
    entry.error = formattedError
  }

  return entry
}

/**
 * Safely serialize a log entry.
 *
 * Logging must never throw because of circular objects or unusual values.
 */
function serializeLogEntry(entry: LogEntry): string {
  try {
    return JSON.stringify(entry)
  } catch {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: entry.level,
      message: entry.message,
      context: '[UNSERIALIZABLE]',
    })
  }
}

/**
 * Runtime-neutral logger.
 *
 * File logging has intentionally been removed from this shared module.
 *
 * Why?
 * `logger.ts` is imported by middleware and client components.
 * Node-only APIs such as:
 *
 *   node:fs
 *   node:path
 *   process.cwd()
 *   require()
 *   eval()
 *
 * cannot exist in a module that may be bundled for Edge/browser execution.
 *
 * Console logging works in:
 * - Browser
 * - Edge
 * - Node.js
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown,
): void {
  const entry = formatLogEntry(level, message, context, error)

  const output = serializeLogEntry(entry)

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console -- `debug` is the correct console level for debug output across all runtimes; the config only whitelists warn/error/info.
      console.debug(output)
      break

    case 'info':
      console.info(output)
      break

    case 'warn':
      console.warn(output)
      break

    case 'error':
      console.error(output)
      break

    default:
      // eslint-disable-next-line no-console -- fallback for unexpected levels; avoids silently dropping a log line.
      console.log(output)
      break
  }
}

/**
 * Public logger API.
 *
 * Keep this API compatible with the existing application so existing imports
 * do not need to be changed.
 */
export const logger = {
  debug: (message: string, context?: LogContext): void => {
    log('debug', message, context)
  },

  info: (message: string, context?: LogContext): void => {
    log('info', message, context)
  },

  warn: (message: string, context?: LogContext): void => {
    log('warn', message, context)
  },

  error: (message: string, context?: LogContext, error?: unknown): void => {
    log('error', message, context, error)
  },

  /**
   * Create a child logger with persistent context.
   */
  child: (context: LogContext) => ({
    debug: (message: string, childContext?: LogContext): void => {
      log('debug', message, {
        ...context,
        ...childContext,
      })
    },

    info: (message: string, childContext?: LogContext): void => {
      log('info', message, {
        ...context,
        ...childContext,
      })
    },

    warn: (message: string, childContext?: LogContext): void => {
      log('warn', message, {
        ...context,
        ...childContext,
      })
    },

    error: (
      message: string,
      error?: unknown,
      childContext?: LogContext,
    ): void => {
      log(
        'error',
        message,
        {
          ...context,
          ...childContext,
        },
        error,
      )
    },
  }),
}
