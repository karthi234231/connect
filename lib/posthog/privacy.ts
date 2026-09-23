// src/lib/posthog/privacy.ts
// ─────────────────────────────────────────────────────────────────────────────
// PostHog integration — PRIVACY CONTROLS (§339 row "PostHog": analytics adapter,
// event mapping, privacy controls; §339 note "Each integration requires an ADR
// and a license/security review"; §121 adoption gate).
//
// Connect already owns a single normalized, PII-safe event pipeline
// (`normalizeFunnelPayload` → Redis buffer → `analytics_events`, ADR-001/003).
// PostHog is therefore a MIRROR, not a second instrumentation source — a second
// source would fragment the taxonomy exactly as §118 forbids.
//
// Two rules keep the mirror safe:
//
// 1. ALLOWLIST, never denylist. Only the normalized funnel dimensions leave the
//    process. `meta` is free-form by contract, so it is dropped unless a key is
//    explicitly allowlisted here. A denylist would silently leak the next field
//    somebody adds.
//
// 2. PSEUDONYMIZATION. PostHog never receives an auth user id. The actor id is
//    HMAC-SHA256-hashed with a Connect-held secret and truncated; the mapping
//    cannot be reversed from PostHog's side, and Connect keeps the only key.
//    Guests keep a session hash so funnel math still works.
//
// Everything in this module is PURE so it is unit-testable without a network or
// an SDK instance.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac } from 'node:crypto'

/**
 * The only properties that may leave the process. These mirror the fields of
 * `NormalizedFunnelEvent` exactly (§118: one vocabulary, no drift).
 */
export const POSTHOG_PROPERTY_ALLOWLIST = [
  'surface',
  'entity_type',
  'profile_state',
  'role',
  'latency_ms',
  'result',
  'error_code',
  'schema_version',
  'correlation_id',
] as const

export type PosthogPropertyKey = (typeof POSTHOG_PROPERTY_ALLOWLIST)[number]

/**
 * `meta` is an escape hatch for callers, so it can contain anything. Only these
 * keys are forwarded — an explicit upgrade path that forces review.
 */
export const POSTHOG_META_ALLOWLIST = [
  'algorithm_version',
  'source_version',
  'position',
  'count',
  'total',
] as const

const ALLOWED = new Set<string>([
  ...POSTHOG_PROPERTY_ALLOWLIST,
  ...POSTHOG_META_ALLOWLIST,
  'event_schema_version',
  'app_env',
])

/**
 * Defence in depth: even an allowlisted key is dropped when its VALUE looks like
 * a direct identifier. Guards against a future caller smuggling an email into
 * `result` (a plausible accident — `result` is a free string today).
 */
const PII_VALUE_PATTERNS: readonly RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  // eslint-disable-next-line security/detect-unsafe-regex -- static, linear-time phone-shape pattern; input strings are capped at 200 chars by isSafePropertyValue before .test().
  /(?:\+?\d[\s-]?){9,}/, // phone-like digit run
  /\b(?:eyJ[A-Za-z0-9_-]{10,})\b/, // JWT segment
  /\bsb_[a-z]+_[A-Za-z0-9]{16,}\b/, // supabase key
]

/** True when a value is safe to forward (primitives only, no identifier shapes). */
export function isSafePropertyValue(value: unknown): boolean {
  if (value === null) return true
  const t = typeof value
  if (t === 'number') return Number.isFinite(value as number)
  if (t === 'boolean') return true
  if (t !== 'string') return false // never forward objects/arrays
  const s = value as string
  if (s.length === 0) return true
  if (s.length > 200) return false // free text is never a dimension
  return !PII_VALUE_PATTERNS.some((re) => re.test(s))
}

/**
 * Reduce an arbitrary property bag to the allowlisted, value-safe subset.
 * Pure. Unknown keys are dropped silently — the mirror must never fail a request
 * because somebody added a field.
 */
export function scrubProperties(
  input: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  if (!input) return out

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED.has(key)) continue
    if (value === undefined) continue
    if (!isSafePropertyValue(value)) continue
    out[key] = value as string | number | boolean | null
  }

  return out
}

/**
 * Stable, irreversible per-actor identifier for PostHog.
 *
 * A null/empty secret returns `null` rather than a weak hash: §121 requires the
 * integration to fail closed, and an unsalted hash of a UUID is guessable.
 */
export function pseudonymizeActor(
  actorId: string | null | undefined,
  secret: string | null | undefined,
): string | null {
  if (!actorId) return null
  if (!secret || secret.length < 16) return null
  return createHmac('sha256', secret).update(actorId).digest('hex').slice(0, 32)
}

/**
 * Deterministic distinct id. An authenticated actor uses its pseudonym; a guest
 * uses a pseudonym of the anonymous session id so guest funnel steps still
 * aggregate without ever naming a person.
 */
export function distinctIdFor(
  actorId: string | null | undefined,
  secret: string | null | undefined,
): string | null {
  const pseudo = pseudonymizeActor(actorId, secret)
  return pseudo === null ? null : `cx_${pseudo}`
}
