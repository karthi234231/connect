// src/lib/analytics/funnel.ts
// ─────────────────────────────────────────────────────────────────────────────
// W5.1 — `trackFunnel` for core product signal (§7.5 Analytics Event Taxonomy).
//
// Normalizes a high-level funnel event into a narrow, PII-safe payload that is
// buffered to Redis and later flushed by `flushAnalyticsBuffer` into
// `analytics_events` / `analytics_daily` (ADR-001 inline + pg_cron).
//
// `normalizeFunnelPayload` is PURE and unit-testable.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

/** Core funnel event names (subset of §7.5 taxonomy). */
export const FunnelEvents = {
  AuthStarted: 'auth_started',
  OAuthStarted: 'oauth_started',
  SignupCompleted: 'signup_completed',
  GuestBrowseStarted: 'guest_browse_started',
  ProfileActionGateSeen: 'profile_action_gate_seen',
  DashboardLoaded: 'dashboard_loaded',
  CandidateViewed: 'candidate_card_viewed',
  CandidateSwiped: 'candidate_swiped',
  IdeaViewed: 'idea_card_viewed',
  IdeaValidated: 'idea_validated',
  IdeaPassed: 'idea_passed',
  JoinRequested: 'join_requested',
  JoinApproved: 'join_approved',
  JoinRejected: 'join_rejected',
  IdentityRevealed: 'identity_revealed',
  MatchCreated: 'match_created',
  ThreadOpened: 'thread_opened',
  MessageSent: 'message_sent',
  EventViewed: 'event_viewed',
  EventSaved: 'event_saved',
  EventShared: 'event_shared',
  EventRsvped: 'event_rsvped',
  CalendarAddClicked: 'calendar_add_clicked',
  SearchPerformed: 'search_performed',
  ReportSubmitted: 'report_submitted',
  BlockCreated: 'block_created',
  AdminReportReviewed: 'admin_report_reviewed',
  GdprExportRequested: 'gdpr_export_requested',
  GdprEraseRequested: 'gdpr_erase_requested',
} as const

export type FunnelEventName = (typeof FunnelEvents)[keyof typeof FunnelEvents]

export interface FunnelInput {
  eventName: FunnelEventName
  /** Authenticated actor id, or an anonymous session id for guests. */
  actorId?: string
  surface?: string
  entityType?: string
  entityId?: string
  profileState?: string
  role?: string
  latencyMs?: number
  result?: string
  errorCode?: string
  /** Optional extra, already-PII-safe dimensions. */
  meta?: Record<string, unknown>
  /** S45 — request correlation id for tracing events across services (#159). */
  correlationId?: string
}

export interface NormalizedFunnelEvent {
  id: string
  event_name: FunnelEventName
  actor_id?: string
  surface?: string
  entity_type?: string
  entity_id?: string
  profile_state?: string
  role?: string
  latency_ms?: number
  result?: string
  error_code?: string
  /** #137 — extra metadata persisted as JSONB, not silently dropped. */
  meta?: Record<string, unknown>
  /** #138 — event schema version for backward-compatible evolution. */
  schema_version: number
  /** S45 — request correlation id (mirrors audit-layer tracing, #159). */
  correlation_id?: string
  created_at: string
}

/**
 * Current funnel event schema version. Bump when the NormalizedFunnelEvent
 * shape changes so downstream consumers can branch on schema evolution.
 * #138
 */
export const FUNNEL_SCHEMA_VERSION = 1

/**
 * Normalize a funnel event into a narrow payload. Pure.
 * The payload is intentionally narrow (no free-form PII) so it stays safe.
 * #137 — meta is carried through so it can be persisted as JSONB.
 * #138 — schema_version is stamped on every event.
 */
export function normalizeFunnelPayload(
  input: FunnelInput,
): NormalizedFunnelEvent {
  return {
    id: randomUUID(),
    event_name: input.eventName,
    actor_id: input.actorId,
    surface: input.surface,
    entity_type: input.entityType,
    entity_id: input.entityId,
    profile_state: input.profileState,
    role: input.role,
    latency_ms: input.latencyMs,
    result: input.result,
    error_code: input.errorCode,
    created_at: new Date().toISOString(),
    meta: input.meta,
    schema_version: FUNNEL_SCHEMA_VERSION,
    // S45 — mirror audit-layer tracing: stamp a fresh id when the caller does
    // not supply one so every event is joinnable back to a traced action (#159).
    correlation_id: input.correlationId ?? randomUUID(),
  }
}

/**
 * Buffer a funnel event for later flush. Never throws — observability must not
 * break the request path.
 */
export async function trackFunnel(input: FunnelInput): Promise<void> {
  const payload = normalizeFunnelPayload(input)
  try {
    await redis.lpush('analytics:events', JSON.stringify(payload))
    logger.debug('Funnel event buffered', {
      event_name: input.eventName,
      actor_id: input.actorId,
    })
  } catch (error) {
    logger.error('Failed to buffer funnel event', {
      event_name: input.eventName,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
