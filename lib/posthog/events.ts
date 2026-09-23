// src/lib/posthog/events.ts
// ────────────────────────────────────────────────────────────────────────────
// PostHog integration — EVENT MAPPING (§339 row "PostHog": analytics adapter,
// event mapping, privacy controls).
//
// Mapping rule (§118 — search/matching/discovery must share one taxonomy):
// the PostHog event name IS the Connect funnel event name, verbatim. There is
// no translation layer, because a translation layer is where vocabularies
// drift. PostHog is a mirror of the pipeline that already feeds
// `analytics_events`, so both systems stay joinable on `event_name`.
//
// This module is PURE: no SDK, no network, no clock beyond the event's own
// `created_at`. It is the part that must never be wrong, so it is the part that
// is fully unit-testable.
// ────────────────────────────────────────────────────────────────────────────
import {
  distinctIdFor,
  pseudonymizeActor,
  scrubProperties,
} from '@/lib/posthog/privacy'

/** Minimal shape this mapper needs — a subset of NormalizedFunnelEvent. */
export interface MappableEvent {
  event_name: string
  actor_id?: string
  created_at?: string
  schema_version?: number
  correlation_id?: string
  surface?: string
  entity_type?: string
  profile_state?: string
  role?: string
  latency_ms?: number
  result?: string
  error_code?: string
  meta?: Record<string, unknown>
}

export interface PostHogCapture {
  /** Pseudonymous actor id — never an auth user id. */
  distinctId: string
  /** The Connect funnel event name, unchanged. */
  event: string
  properties: Record<string, string | number | boolean | null>
  timestamp?: Date
}

export interface MappingConfig {
  pseudonymSecret: string | null
  appEnv: string
}

/**
 * Map one buffered funnel event to a PostHog capture.
 *
 * Returns `null` when the event cannot be mirrored safely:
 * - no actor → no distinct id can be derived, and inventing one would
 *   manufacture a fake person in PostHog;
 * - no configured secret → `distinctIdFor` fails closed (§121).
 *
 * A null result is a normal outcome, not an error: the mirror is best-effort.
 */
export function toPostHogCapture(
  event: MappableEvent,
  config: MappingConfig,
): PostHogCapture | null {
  if (!event || typeof event.event_name !== 'string' || !event.event_name) {
    return null
  }

  const distinctId = distinctIdFor(event.actor_id, config.pseudonymSecret)
  if (!distinctId) return null

  // `pseudonymizeActor` is re-run only to keep the actor id out of properties;
  // privacy.ts is the single authority for both.
  const actorPseudonym = pseudonymizeActor(
    event.actor_id,
    config.pseudonymSecret,
  )

  const properties = scrubProperties({
    surface: event.surface,
    entity_type: event.entity_type,
    profile_state: event.profile_state,
    role: event.role,
    latency_ms: event.latency_ms,
    result: event.result,
    error_code: event.error_code,
    schema_version: event.schema_version,
    correlation_id: event.correlation_id,
    ...(event.meta ?? {}),
    // Stamped here, not read from the SDK: the mirror must record where the
    // data came from and which deployment produced it.
    event_schema_version: event.schema_version,
    app_env: config.appEnv,
  })

  // The pseudonym is a correlation handle, not an identity: it lets two events
  // from the same actor be related without PostHog holding the actor id.
  if (actorPseudonym) {
    properties.actor_pseudonym = actorPseudonym
  }

  const parsed = event.created_at ? Date.parse(event.created_at) : NaN
  const timestamp = Number.isFinite(parsed) ? new Date(parsed) : undefined

  return {
    distinctId,
    event: event.event_name,
    properties,
    ...(timestamp ? { timestamp } : {}),
  }
}

/**
 * Map a batch, dropping unmappable events. Bounded so one large drain cannot
 * unbounded-buffer in a serverless function.
 *
 * §4: the analytics flush is a background worker, but it still must not grow
 * memory without limit.
 */
export const MAX_MIRROR_BATCH = 500

export function mapPostHogBatch(
  events: readonly MappableEvent[],
  config: MappingConfig,
): PostHogCapture[] {
  const out: PostHogCapture[] = []
  const limit = Math.min(events.length, MAX_MIRROR_BATCH)

  for (let i = 0; i < limit; i += 1) {
    const capture = toPostHogCapture(events[i], config)
    if (capture) out.push(capture)
  }

  return out
}
