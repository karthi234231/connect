// src/lib/analytics/flush.ts
// Audit #22-24: atomic claim semantics. A worker atomically RENAMENX-es the
// live buffer into a per-worker processing key, so a producer appending while
// a flush runs can never have its event silently deleted (the lost-event race
// in the old LRANGE->...->DEL sequence). Events stay in the processing key
// until they are durably inserted. Daily rollup is recomputed DB-side.
//
// Durability hardening on top of the RENAMENX claim:
// - A stale claim (worker crashed post-claim) is RECOVERED, not deleted: the
//   abandoned processing batch is drained before a new claim is taken.
// - Inserts are idempotent (event id + ignoreDuplicates), so a retried or
//   double-drained batch can neither duplicate rows nor poison the batch via
//   a PK conflict.
// - If the daily rollup fails, the raw rows are already durable and a
//   `pending_since` marker makes the next successful flush re-aggregate from
//   that timestamp — rollup failure can never lose daily totals (#23).

import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { mirrorEventsToPostHog } from '@/lib/posthog/mirror'

const BUFFER_KEY = 'analytics:events'
const PROCESSING_KEY = 'analytics:events:processing'
const CLAIM_KEY = 'analytics:events:claim'
const ROLLUP_PENDING_KEY = 'analytics:rollup:pending_since'
const CLAIM_TTL_MS = 5 * 60 * 1000
const ROLLUP_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 1000 // bounded batch size for analytics flush

interface BufferedEvent {
  id?: string
  event_name?: string
  actor_id?: string
  surface?: string
  entity_type?: string
  entity_id?: string
  profile_state?: string
  role?: string
  latency_ms?: number
  result?: string
  error_code?: string
  created_at?: string
  meta?: Record<string, unknown>
  schema_version?: number
  algorithm_version?: string
  source_version?: string
  /** S45 — request correlation id for cross-service tracing (#159). */
  correlation_id?: string
}

function safeParse(raw: string): BufferedEvent | null {
  try {
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.event_name === 'string'
    ) {
      return parsed as BufferedEvent
    }
    return null
  } catch {
    return null
  }
}

type AdminClient = ReturnType<typeof getAdminSupabaseClient>

async function drainProcessing(
  admin: NonNullable<AdminClient>,
): Promise<number> {
  let totalPersisted = 0
  let earliest: string | null = null
  let pendingSince: string | null = null
  try {
    const marker = await redis.get(ROLLUP_PENDING_KEY)
    pendingSince =
      marker === null || marker === undefined ? null : String(marker)
  } catch {
    pendingSince = null
  }

  // Process the processing list in bounded batches to avoid memory spikes
  while (true) {
    let raw: string[]
    try {
      raw = (await redis.lrange(
        PROCESSING_KEY,
        0,
        BATCH_SIZE - 1,
      )) as unknown as string[]
    } catch (error) {
      logger.error('Analytics flush: redis read failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      break
    }

    if (!raw.length) break

    // Remove the batch we just read
    await redis.ltrim(PROCESSING_KEY, BATCH_SIZE, -1).catch(() => {})

    const events = raw
      .map(safeParse)
      .filter((e): e is BufferedEvent => e !== null)

    if (!events.length) continue

    const rows = events.map((e) => ({
      id: e.id ?? randomUUID(),
      event_name: e.event_name ?? 'unknown',
      actor_id: e.actor_id ?? null,
      surface: e.surface ?? null,
      entity_type: e.entity_type ?? null,
      entity_id: e.entity_id ?? null,
      profile_state: e.profile_state ?? null,
      role: e.role ?? null,
      latency_ms: e.latency_ms ?? null,
      result: e.result ?? null,
      error_code: e.error_code ?? null,
      created_at: e.created_at ?? new Date().toISOString(),
      meta: e.meta ?? null,
      schema_version: e.schema_version ?? 1,
      algorithm_version: e.algorithm_version ?? null,
      source_version: e.source_version ?? null,
      correlation_id: e.correlation_id ?? null,
    }))

    const { error } = await admin
      .from('analytics_events')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      logger.error(
        'Analytics flush: insert failed — processing batch retained',
        {
          count: rows.length,
          error: error.message,
        },
      )
      // Re-insert the failed batch at the front for retry
      await redis.lpush(PROCESSING_KEY, ...raw).catch(() => {})
      break
    }

    totalPersisted += rows.length

    // §339 PostHog mirror — runs ONLY after the rows are durable, so PostHog is
    // a replica of data Connect already owns and an outage there cannot lose an
    // event. `events` (not `rows`) is mapped: only the normalized funnel shape
    // is eligible, and mirror.ts fails closed on a missing pseudonym secret.
    // Fire-and-await but never throw: `ignoreDuplicates` above makes a retried
    // batch safe, and a mirror failure must not poison the analytics drain.
    try {
      // `safeParse` already guaranteed a string `event_name`; narrow for TS.
      const mappable = events.filter(
        (e): e is BufferedEvent & { event_name: string } =>
          typeof e.event_name === 'string',
      )
      await mirrorEventsToPostHog(mappable)
    } catch (error) {
      logger.warn('Analytics flush: PostHog mirror failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Track earliest event across batches
    const batchEarliest = events.reduce(
      (min, e) =>
        !e.created_at || min === null || e.created_at < min
          ? (e.created_at ?? min)
          : min,
      null as string | null,
    )
    if (
      batchEarliest !== null &&
      (earliest === null || batchEarliest < earliest)
    ) {
      earliest = batchEarliest
    }
  }

  // Daily rollup: earliest event across all batches, extended backwards to any
  // previously-failed rollup marker so missed days self-heal (#23).
  const since =
    earliest !== null && pendingSince !== null && pendingSince < earliest
      ? pendingSince
      : (earliest ?? pendingSince)

  if (since !== null) {
    const rollup = await admin.rpc('refresh_analytics_daily', { since })
    if (rollup.error) {
      logger.warn('Analytics flush: daily rollup failed — marker retained', {
        error: rollup.error.message,
        since,
      })
      await redis
        .set(ROLLUP_PENDING_KEY, since, { px: ROLLUP_PENDING_TTL_MS })
        .catch(() => {})
    } else if (pendingSince !== null) {
      // Window covered the failed marker's timestamp; clear it.
      await redis.del(ROLLUP_PENDING_KEY).catch(() => {})
    }
  }

  // Only clean up if the list is fully drained; otherwise leave remaining
  // events for the next flush attempt.
  let remainingLength = 0
  try {
    remainingLength = await redis.llen(PROCESSING_KEY)
  } catch {
    // ignore
  }
  if (remainingLength === 0) {
    await redis.del(PROCESSING_KEY).catch(() => {})
    await redis.del(CLAIM_KEY).catch(() => {})
  }
  logger.info('Analytics flush completed', { persisted: totalPersisted })
  return totalPersisted
}

export async function flushAnalyticsBuffer(): Promise<number> {
  const admin = getAdminSupabaseClient()
  if (!admin) {
    logger.error('Analytics flush skipped: admin client unavailable')
    return 0
  }

  let recovered = 0
  const processingExists = await redis.exists(PROCESSING_KEY)
  if (processingExists) {
    const claimAt = await redis.get(CLAIM_KEY)
    const fresh =
      claimAt !== null && Date.now() - Number(claimAt) < CLAIM_TTL_MS
    if (fresh) {
      logger.debug('Analytics flush: another worker in progress; skipping')
      return 0
    }
    // Stale claim: the previous worker died after claiming but before
    // persisting. Recover the abandoned batch instead of discarding it (#22).
    recovered = await drainProcessing(admin)
  }

  let claimed: 0 | 1
  try {
    claimed = await redis.renamenx(BUFFER_KEY, PROCESSING_KEY)
  } catch (error) {
    logger.error('Analytics flush: claim failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return recovered
  }
  if (!claimed) {
    logger.debug('Analytics flush: buffer empty or claim held')
    return recovered
  }

  await redis
    .set(CLAIM_KEY, String(Date.now()), { px: CLAIM_TTL_MS })
    .catch(() => {})

  return recovered + (await drainProcessing(admin))
}
