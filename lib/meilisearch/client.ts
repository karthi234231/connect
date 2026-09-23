// src/lib/meilisearch/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// Meilisearch integration — CLIENT (§339 row "Meilisearch": client, index
// schema, sync worker, search adapter, tests; §340 steps 5–8: env schema,
// config, local dependency, health check).
//
// SEARCH IS OPTIONAL. `getMeiliClient()` returns `null` when unconfigured, and
// every caller must fall back to the existing in-DB `token-rank` path
// (src/services/search/service.ts, #118). Search is a UX enhancement, never a
// hard dependency of a page render.
//
// Construction is deferred to first use — `next build` evaluates every module
// that a route transitively imports, so an eager client would run at build
// time. Same reasoning as src/lib/redis.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { Meilisearch } from 'meilisearch'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export interface MeiliConfig {
  host: string | null
  apiKey: string | null
  indexPrefix: string
}

/** Default local host (`meilisearch --master-key=... --env=development`). */
export const MEILI_DEFAULT_HOST = 'http://127.0.0.1:7700'

/**
 * Read config defensively. `env` throws lazily when REQUIRED variables are
 * missing; Meilisearch is optional, so any throw collapses to "disabled"
 * rather than propagating into a request path.
 */
export function readMeiliConfig(): MeiliConfig {
  try {
    return {
      host: env.MEILISEARCH_HOST?.trim().replace(/\/+$/, '') || null,
      apiKey: env.MEILISEARCH_API_KEY?.trim() || null,
      indexPrefix: env.MEILISEARCH_INDEX_PREFIX?.trim() || 'connect_',
    }
  } catch {
    return { host: null, apiKey: null, indexPrefix: 'connect_' }
  }
}

/** True only when a host is configured — the minimum needed to talk to Meili. */
export function isMeiliEnabled(): boolean {
  return Boolean(readMeiliConfig().host)
}

let clientSingleton: Meilisearch | null = null
let resolved = false

/**
 * Lazy singleton. Returns `null` (never throws) when disabled or when the SDK
 * refuses to construct, so callers branch on `null` instead of try/catch.
 */
export function getMeiliClient(): Meilisearch | null {
  if (resolved) return clientSingleton
  resolved = true

  const { host, apiKey } = readMeiliConfig()
  if (!host) {
    clientSingleton = null
    return null
  }

  try {
    clientSingleton = new Meilisearch({ host, apiKey: apiKey ?? undefined })
    logger.info('Meilisearch client initialised', { host })
    return clientSingleton
  } catch (error) {
    logger.error('Meilisearch client construction failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    clientSingleton = null
    return null
  }
}

/**
 * §340 step 8 — health check. Performs a REAL round trip (`health()`), unlike
 * the PostHog check: Meilisearch is the search-critical path and "configured"
 * is not the same as "reachable". Bounded by the SDK's own timeout and never
 * throws, so it is safe to call from a worker.
 */
export async function meiliHealth(): Promise<{
  enabled: boolean
  reachable: boolean
  host: string | null
  status: string | null
}> {
  const { host } = readMeiliConfig()
  const client = getMeiliClient()

  if (!client) {
    return { enabled: false, reachable: false, host, status: null }
  }

  try {
    const health = await client.health()
    return {
      enabled: true,
      reachable: true,
      host,
      status: health.status ?? 'available',
    }
  } catch (error) {
    logger.warn('Meilisearch health check failed', {
      host,
      error: error instanceof Error ? error.message : String(error),
    })
    return { enabled: true, reachable: false, host, status: null }
  }
}
