// src/lib/observability.ts
// ─────────────────────────────────────────────────────────────────────────────
// W5.1 — `captureError` with guaranteed PII scrubbing before anything is
// logged or sent to Sentry.
//
// • `scrubForObservability` is PURE and unit-testable.
// • `captureError` never throws so error reporting can't break the request.
// • Sentry is only reached when `SENTRY_DSN` is configured (owner-provided,
//   track S16); otherwise the error is logged through the project logger.
// ─────────────────────────────────────────────────────────────────────────────
import { logger } from '@/lib/logger'

const SENSITIVE_KEY_RE =
  /(email|phone|password|passwd|pwd|secret|token|authorization|bearer|cookie|session|api[_-]?key|apikey|credit|card|cvv|ssn|ip|latitude|longitude)/i

// Matches (a) `key=value` secret syntax, (b) full 3-segment JWTs, and
// (c) free-floating `Bearer <token>` values. Non-global: used with `.test()`.
const SENSITIVE_VALUE_RE =
  /(?:token|secret|password|authorization|bearer|api[_-]?key)\s*[=:]\s*[^\s;,&]+|eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}|\bbearer\s+[a-zA-Z0-9._~+/=-]{8,}/i

// Global clone for `String.replace` (replaces every occurrence).
// eslint-disable-next-line security/detect-non-literal-regexp -- derived from the compile-time constant SENSITIVE_VALUE_RE source above, never from runtime input.
const SENSITIVE_VALUE_RE_GLOBAL = new RegExp(SENSITIVE_VALUE_RE.source, 'gi')

const MAX_DEPTH = 5
const REDACTED = '[REDACTED]'

/** True when a JSON-ish value carries obvious PII/secret signals. */
export function looksSensitive(key: string, value: unknown): boolean {
  if (SENSITIVE_KEY_RE.test(key)) return true
  if (typeof value === 'string' && SENSITIVE_VALUE_RE.test(value)) return true
  return false
}

/**
 * Recursively redact PII / secrets from arbitrary payloads before they leave
 * the server (logs, Sentry `extra`, audit metadata). Pure.
 */
export function scrubForObservability(
  value: unknown,
  key = '',
  depth = 0,
): unknown {
  if (value === null || value === undefined) return value
  if (depth > MAX_DEPTH) return '[MAX_DEPTH]'
  if (looksSensitive(key, value)) return REDACTED

  if (Array.isArray(value)) {
    return value.map((item) => scrubForObservability(item, key, depth + 1))
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubForObservability(v, k, depth + 1)
    }
    return out
  }

  if (typeof value === 'string') {
    // Scrub inline `token=...`, `Bearer eyJ...` substrings.
    return value.replace(SENSITIVE_VALUE_RE_GLOBAL, REDACTED)
  }

  return value
}

/**
 * Report an error through the project logger and (when configured) Sentry.
 * The context payload is scrubbed before it ever reaches a sink.
 * Never throws.
 */
export async function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const safe = scrubForObservability(context ?? {}) as Record<string, unknown>
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error'

  logger.error('captureError', { error: message, context: safe })

  if (!process.env.SENTRY_DSN) {
    // W5.1 — Sentry wiring is owned by S16 (env secrets). Log-only fallback.
    return
  }

  try {
    // Lazy import keeps the Sentry SDK out of test/bundler paths when unused.
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, { extra: safe })
  } catch (sentryError) {
    logger.warn('Sentry capture failed', {
      error:
        sentryError instanceof Error
          ? sentryError.message
          : String(sentryError),
    })
  }
}
