// src/lib/posthog/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// PostHog integration — CLIENT (§339 row "PostHog": analytics adapter, event
// mapping, privacy controls; §340 step 5–8: env schema, config, local
// dependency, health check).
//
// The real `posthog-node` SDK is the transport. This module is the seam: it
// owns construction, health and shutdown, so nothing else in Connect touches
// the SDK directly and the whole integration stays swappable.
//
// FAIL CLOSED. `isPostHogEnabled()` is false unless BOTH the project key and a
// ≥16-char pseudonym secret are configured. An unhashed UUID is guessable, so
// a missing secret disables the mirror rather than weakening identifiers
// (§121 adoption gate, §106 security-first).
// ─────────────────────────────────────────────────────────────────────────────
import { PostHog } from 'posthog-node'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export interface PostHogConfig {
  apiKey: string | null
  host: string | null
  pseudonymSecret: string | null
}

/** PostHog default US ingestion host, used only when POSTHOG_HOST is unset. */
export const POSTHOG_DEFAULT_HOST = 'https://us.i.posthog.com'

/**
 * Read config defensively. `env` is a lazy Proxy that THROWS when required
 * variables are missing (src/lib/env.ts), and PostHog is optional — an
 * optional integration must never be able to break the request path, so any
 * throw collapses to "not configured".
 */
export function readPostHogConfig(): PostHogConfig {
  try {
    return {
      apiKey: env.POSTHOG_API_KEY?.trim() || null,
      host: env.POSTHOG_HOST?.trim() || null,
      pseudonymSecret: env.POSTHOG_PSEUDONYM_SECRET?.trim() || null,
    }
  } catch {
    return { apiKey: null, host: null, pseudonymSecret: null }
  }
}

/** True only when the mirror can run without weakening privacy. */
export function isPostHogEnabled(): boolean {
  const { apiKey, pseudonymSecret } = readPostHogConfig()
  return Boolean(apiKey && pseudonymSecret && pseudonymSecret.length >= 16)
}

let clientSingleton: PostHog | null = null
let resolved = false

/**
 * Lazy singleton — mirrors `src/lib/redis.ts`. Construction is deferred to
 * first use because `next build` evaluates modules for every importing route.
 * Returns `null` (never throws) when the integration is disabled or the SDK
 * fails to construct.
 */
export function getPostHogClient(): PostHog | null {
  if (resolved) return clientSingleton
  resolved = true

  const { apiKey, host, pseudonymSecret } = readPostHogConfig()

  if (!apiKey || !pseudonymSecret || pseudonymSecret.length < 16) {
    clientSingleton = null
    return null
  }

  try {
    clientSingleton = new PostHog(apiKey, {
      host: host ?? POSTHOG_DEFAULT_HOST,
      // `capture` is batched: the mirror must not add latency to a request.
      // §4 split SLOs — write/server-action p95 stays under its budget.
      flushInterval: 10_000,
      maxQueueSize: 1_000,
      // Defence in depth. Even if a property slipped past the allowlist in
      // privacy.ts, PostHog must not enrich it with geo/IP-derived data.
      disableGeoip: true,
      // Drop any property PostHog would otherwise persist on a person.
      privacyMode: true,
      // In-process only: a serverless function must not attempt disk access.
      persistence: 'memory',
    })
    logger.info('PostHog mirror initialised', {
      host: host ?? POSTHOG_DEFAULT_HOST,
    })
    return clientSingleton
  } catch (error) {
    logger.error('PostHog client construction failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    clientSingleton = null
    return null
  }
}

/**
 * Flush the queue. Never throws — called on shutdown paths where a failure
 * must not mask the real result. A no-op when the mirror is disabled.
 */
export async function flushPostHog(): Promise<void> {
  const client = getPostHogClient()
  if (!client) return
  try {
    await client.flush()
  } catch (error) {
    logger.warn('PostHog flush failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * §340 step 8 — health check. Reports configuration state without performing a
 * network round trip (a health check that can hang is not a health check).
 */
export function postHogHealth(): {
  enabled: boolean
  host: string
  pseudonymConfigured: boolean
} {
  const { host, pseudonymSecret } = readPostHogConfig()
  return {
    enabled: isPostHogEnabled(),
    host: host ?? POSTHOG_DEFAULT_HOST,
    pseudonymConfigured: Boolean(
      pseudonymSecret && pseudonymSecret.length >= 16,
    ),
  }
}
