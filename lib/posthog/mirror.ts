// src/lib/posthog/mirror.ts
// ────────────────────────────────────────────────────────────────────────────
// PostHog integration — ADAPTER (§339 row "PostHog": "analytics adapter").
//
// Connect's canonical analytics pipeline is Redis buffer → `analytics_events`
// (ADR-001 inline + pg_cron, ADR-003 `/lib/cache`). PostHog is a downstream
// MIRROR of that already-persisted stream — never a second producer. Mirroring
// at flush time (not at request time) means:
//
// - zero added latency to any user-facing request (§4 split SLOs);
// - the durable row is written first, so a PostHog outage cannot lose an event;
// - one batch, one network leg.
//
// FAIL OPEN. Every failure is logged and swallowed. An optional analytics
// destination must never be able to fail a background worker or a cron tick.
// ────────────────────────────────────────────────────────────────────────────
import { logger } from '@/lib/logger'
import {
  getPostHogClient,
  isPostHogEnabled,
  readPostHogConfig,
} from '@/lib/posthog/client'
import { mapPostHogBatch, type MappableEvent } from '@/lib/posthog/events'

export interface MirrorResult {
  /** True when the integration is configured and was attempted. */
  enabled: boolean
  /** Captures handed to the SDK queue. */
  mirrored: number
  /** Events dropped because they had no safe distinct id. */
  skipped: number
}

function appEnvName(): string {
  return process.env.NODE_ENV ?? 'development'
}

/**
 * Mirror a batch of already-persisted funnel events into PostHog.
 *
 * Called AFTER `analytics_events` rows are durably written, so this is a
 * best-effort replica of data Connect already owns.
 */
export async function mirrorEventsToPostHog(
  events: readonly MappableEvent[],
): Promise<MirrorResult> {
  if (events.length === 0) {
    return { enabled: isPostHogEnabled(), mirrored: 0, skipped: 0 }
  }

  const client = getPostHogClient()
  if (!client) {
    // Disabled or failed to construct. Not an error — recorded at debug so a
    // missing optional integration does not page anyone.
    logger.debug('PostHog mirror skipped: integration disabled')
    return { enabled: false, mirrored: 0, skipped: 0 }
  }

  const { pseudonymSecret } = readPostHogConfig()

  let captures
  try {
    captures = mapPostHogBatch(events, {
      pseudonymSecret,
      appEnv: appEnvName(),
    })
  } catch (error) {
    logger.warn('PostHog mirror: mapping failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { enabled: true, mirrored: 0, skipped: 0 }
  }

  let mirrored = 0
  for (const capture of captures) {
    try {
      client.capture({
        distinctId: capture.distinctId,
        event: capture.event,
        properties: capture.properties,
        ...(capture.timestamp ? { timestamp: capture.timestamp } : {}),
      })
      mirrored += 1
    } catch (error) {
      // One malformed capture must not abort the batch.
      logger.debug('PostHog mirror: capture rejected', {
        event: capture.event,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const skipped = events.length - captures.length
  if (skipped > 0) {
    logger.debug('PostHog mirror: events without a safe distinct id', {
      skipped,
    })
  }

  return { enabled: true, mirrored, skipped }
}
