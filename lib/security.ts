// src/lib/security.ts

import { createHash, randomUUID, timingSafeEqual } from 'crypto'
import { headers } from 'next/headers'
import { isSafeRedirectUrl as isSafeRedirectUrlCanonical } from '@/lib/redirect'
import { isProduction } from '@/lib/env'
import { logger } from '@/lib/logger'
import { scrubForObservability } from '@/lib/observability'

export function generateCspNonce(): string {
  return randomUUID()
}

export async function getCspNonce(): Promise<string | null> {
  try {
    const headersList = await headers()
    return headersList.get('x-csp-nonce')
  } catch {
    return null
  }
}

export function buildCspHeader(nonce: string): string {
  const scriptSrc = `'nonce-${nonce}' 'strict-dynamic'`

  const connectSrc = isProduction
    ? "'self' https://*.supabase.co https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://challenges.cloudflare.com"
    : "'self' http://localhost:* ws://localhost:* wss://localhost:* https://*.supabase.co https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://*.posthog.com https://*.sentry.io https://*.ingest.sentry.io https://challenges.cloudflare.com"

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /api/security/csp-report',
    'report-to csp-endpoint',
  ].join('; ')
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
} as const

export type SecurityHeaderKey = keyof typeof SECURITY_HEADERS

export function getSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS }
}

export function logCspViolation(violation: unknown): void {
  // CSP reports carry attacker-influenced URLs (`blocked-uri`, `document-uri`,
  // `source-file`) whose query strings routinely hold tokens/secrets. Scrub
  // before anything reaches the log sink — same rule as captureError.
  logger.warn('CSP violation detected', {
    violation: scrubForObservability(violation),
  })
}

export function isSafeRedirectUrl(value: string): boolean {
  // Canonical validator lives in the pure, client-safe module. This re-export
  // keeps existing server callers working while consolidating to ONE authority
  // (HOST-AUTH-06) — never maintain a divergent local copy here.
  return isSafeRedirectUrlCanonical(value)
}

/**
 * Constant-time string comparison for secrets (bearer tokens, cron secrets).
 *
 * Both inputs are hashed to a fixed-length SHA-256 digest before comparison,
 * for three reasons:
 *   1. `timingSafeEqual` throws on a length mismatch, so raw inputs cannot be
 *      compared directly without branching (which itself leaks length).
 *   2. Digests are always 32 bytes, so the comparison runs in constant time
 *      and never throws — no length/prefix information escapes the compare.
 *   3. Zero-padding the shorter buffer is NOT a valid substitute: it maps
 *      distinct secrets onto identical byte sequences, so `'a\u0000'` and
 *      `'a'` would compare equal (trailing-NUL collapse). Hashes of different
 *      inputs always differ.
 *
 * Returns `false` (never throws) for any mismatch, including unequal lengths.
 */
export function safeCompare(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest()
  const digestB = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(digestA, digestB)
}
