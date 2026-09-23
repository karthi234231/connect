// src/services/relationships/relationship-safety.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-04 — canonical, server-resolved chat safety operations.
//
// Every operation takes the ACTING user id first and RESOLVES the target
// relationship server-side (fetch the match row, verify the participant). The
// acting user is derived by the caller from the trusted auth context
// (`requireUser()`); no body/query/path field can substitute the actor. A
// forged user id in any request position therefore cannot change who acts.
//
// Canonical operations:
//   muteConversation(userId, matchId)      → durable, DB-enforced state
//   archiveConversation(userId, matchId)   → durable, DB-enforced state
//   reportConversation(userId, matchId, reason, note?) → reuses reports infra
//   blockUser(userId, targetUserId)        → canonical re-export (fail-closed)
//   removeConnection(userId, matchId)      → match → declined (existing enum)
//
// Durable state for mute/archive lives in `match_relationship_settings`
// (migration 20260907100000_relationship_safety.sql): one canonical `state`
// value per (user, match), CHECK-constrained in the DB AND mirrored in the
// zod schema below. Participant membership is DB-enforced by trigger.
//
// Cache/read-model invalidation:
//   * block/removal invalidate the affected Redis block caches AND the
//     per-user Next caches for BOTH participants (reused from safety.service).
//   * chat_threads is a DB-side projection (20260906160000) and relationship
//     momentum reads live rows — there is no relationship read-model cache to
//     invalidate; nothing is invented here.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { invalidateUserCache } from '@/lib/cache'
import {
  blockUser as canonicalBlockUser,
  createReportRecord,
  reportReasonSchema,
  type ReportRecordResult,
} from '@/services/safety/safety.service'
import { z } from 'zod'

// ─── Canonical mute/archive state machine ───────────────────────────────────

export const RELATIONSHIP_SETTING_STATES = [
  'default',
  'muted',
  'archived',
  'muted_archived',
] as const

export type RelationshipSettingState =
  (typeof RELATIONSHIP_SETTING_STATES)[number]

/** Mirrors the DB CHECK `match_relationship_settings_state_canonical`. */
export const relationshipSettingStateSchema = z.enum(
  RELATIONSHIP_SETTING_STATES,
)

export type RelationshipSettingAction = 'mute' | 'archive'

export interface MatchRelationshipResolution {
  match: {
    id: string
    user1_id: string
    user2_id: string
    status: string
  }
  /** The other participant (used for block/report/remove targets). */
  otherUserId: string
}

/**
 * Pure identity of the OTHER participant. Returns null when userId is not a
 * participant — the service layer turns that into 403.
 */
export function deriveOtherParticipant(
  match: { user1_id: string; user2_id: string },
  userId: string,
): string | null {
  if (match.user1_id === userId) return match.user2_id
  if (match.user2_id === userId) return match.user1_id
  return null
}

/**
 * Pure canonical transition for mute/archive. Returns the next canonical
 * state; throws AppError(VALIDATION) for unknown current states or actions so
 * the service can never write an out-of-schema value to the DB CHECK.
 */
export function nextSettingState(
  current: RelationshipSettingState,
  action: RelationshipSettingAction,
): RelationshipSettingState {
  const parsed = relationshipSettingStateSchema.safeParse(current)
  if (!parsed.success) {
    throw AppError.validation('Unknown relationship setting state', {
      current: [String(current)],
    })
  }

  if (action === 'mute') {
    switch (parsed.data) {
      case 'default':
        return 'muted'
      case 'archived':
        return 'muted_archived'
      case 'muted':
        return 'muted'
      case 'muted_archived':
        return 'muted_archived'
    }
  }

  if (action === 'archive') {
    switch (parsed.data) {
      case 'default':
        return 'archived'
      case 'muted':
        return 'muted_archived'
      case 'archived':
        return 'archived'
      case 'muted_archived':
        return 'muted_archived'
    }
  }

  throw AppError.validation('Unknown relationship setting action', {
    action: [String(action)],
  })
}

// ─── Server-side relationship resolution ────────────────────────────────────

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>

interface MatchRow {
  id: string
  user1_id: string
  user2_id: string
  status: string
}

// The generated schema types omit some projections used below (and loose
// builders for non-public tables); bind those PostgREST chains to this minimal
// structural type.

type LooseQuery = PromiseLike<{
  data: unknown
  error: { message: string; code?: string } | null
}> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  maybeSingle: () => LooseQuery
}

type LooseTable = {
  from: (table: string) => LooseQuery
}

/**
 * Resolve the match the actor claims to operate on and verify participation.
 * The actor is the trusted userId parameter; the target relationship is always
 * derived from the stored `matches` row, never from a client-supplied actor.
 */
export async function resolveMatchForParticipant(
  supabase: ServerSupabase,
  userId: string,
  matchId: string,
): Promise<MatchRelationshipResolution> {
  const { data: match, error } = await (supabase as unknown as LooseTable)
    .from('matches')
    .select('id, user1_id, user2_id, status')
    .eq('id', matchId)
    .maybeSingle()

  if (error) {
    logger.error('Relationship safety: match lookup failed', {
      matchId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to resolve relationship', {
      cause: error,
    })
  }

  if (!match) {
    throw AppError.notFound('Match', matchId)
  }

  const matchRow = match as unknown as MatchRow
  const otherUserId = deriveOtherParticipant(matchRow, userId)

  if (!otherUserId) {
    logger.warn('Relationship safety: denied — not a participant', {
      matchId,
      userId,
    })
    throw AppError.forbidden('You are not a participant in this thread.')
  }

  return { match: matchRow, otherUserId }
}

// ─── Mute / archive (durable DB-backed state) ───────────────────────────────

const SETTINGS_TABLE = 'match_relationship_settings'

async function setRelationshipSetting(
  userId: string,
  matchId: string,
  action: RelationshipSettingAction,
): Promise<RelationshipSettingState> {
  const supabase = await createServerSupabaseClient()

  // Authorization first: 404 for missing match, 403 for non-participants.
  await resolveMatchForParticipant(supabase, userId, matchId)

  let current: RelationshipSettingState = 'default'

  const { data: existing, error: readError } = await (
    supabase as unknown as LooseTable
  )
    .from(SETTINGS_TABLE)
    .select('state')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .maybeSingle()

  if (readError) {
    // Fail closed: without a trustworthy current state we cannot compute a
    // canonical next state, so we refuse to write.
    logger.error('Relationship safety: setting read failed', {
      matchId,
      userId,
      error: readError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to update conversation', {
      cause: readError,
    })
  }

  if ((existing as { state?: string } | null)?.state) {
    const parsed = relationshipSettingStateSchema.safeParse(
      (existing as { state: string }).state,
    )
    if (!parsed.success) {
      // The DB CHECK should make this unreachable — fail closed rather than
      // propagate corrupt state.
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to update conversation')
    }
    current = parsed.data
  }

  const next = nextSettingState(current, action)

  const { error: writeError } = await (
    supabase as unknown as {
      from: (table: string) => {
        upsert: (
          value: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .from(SETTINGS_TABLE)
    .upsert(
      { user_id: userId, match_id: matchId, state: next },
      { onConflict: 'user_id,match_id' },
    )

  if (writeError) {
    logger.error('Relationship safety: setting write failed', {
      matchId,
      userId,
      action,
      error: writeError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to update conversation', {
      cause: writeError,
    })
  }

  // The actor's thread/relationship read models changed (their own view).
  // Other-participant views are NOT affected (mute/archive are per-user).
  invalidateUserCache(userId)

  return next
}

/** Mute a conversation. Idempotent: re-muting converges to the same state. */
export async function muteConversation(
  userId: string,
  matchId: string,
): Promise<RelationshipSettingState> {
  return setRelationshipSetting(userId, matchId, 'mute')
}

/** Archive a conversation. Idempotent: re-archiving converges to the same state. */
export async function archiveConversation(
  userId: string,
  matchId: string,
): Promise<RelationshipSettingState> {
  return setRelationshipSetting(userId, matchId, 'archive')
}

// ─── Report conversation (reuses the canonical reports infrastructure) ─────

/**
 * Report a conversation. The target is the match itself; `reported_id`
 * resolves to the OTHER participant (reports.reported_id keeps its auth.users
 * FK), and `reported_match_id` scopes dedupe + moderation triage to the
 * specific conversation. Rate limit + dedupe semantics match reportUser.
 */
export async function reportConversation(
  userId: string,
  matchId: string,
  reason: string,
  note?: string,
): Promise<ReportRecordResult> {
  const parsedReason = reportReasonSchema.safeParse(reason)
  if (!parsedReason.success) {
    throw AppError.validation('Invalid report reason')
  }

  const supabase = await createServerSupabaseClient()
  const { otherUserId } = await resolveMatchForParticipant(
    supabase,
    userId,
    matchId,
  )

  return createReportRecord({
    reporterId: userId,
    reportedId: otherUserId,
    reportedMatchId: matchId,
    reason: parsedReason.data,
    note,
  })
}

// ─── Block ──────────────────────────────────────────────────────────────────

/**
 * Canonical user→user block. Re-exported from safety.service so there is a
 * single block authority. Actor is the first parameter (trusted auth id);
 * fail-closed on DB error; idempotent (upsert on existing pair); invalidates
 * the block caches + user caches of BOTH users.
 */
export const blockUser = canonicalBlockUser

/**
 * Conversation-scoped block: resolve the match server-side and block the
 * OTHER participant — satisfies "verify the other participant for block"
 * without ever trusting a client-supplied actor.
 */
export async function blockMatchUser(
  userId: string,
  matchId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { otherUserId } = await resolveMatchForParticipant(
    supabase,
    userId,
    matchId,
  )
  await blockUser(userId, otherUserId)
}

// ─── Remove connection ──────────────────────────────────────────────────────

/**
 * Permanently remove a connection by transitioning the match to `declined` —
 * the existing terminal status (match_status enum 20260804204014). The DB
 * trigger (20260904100000 + 20260904180000) already enforces the legal
 * transitions (pending→declined, active→declined, same-status idempotent).
 * Repeated removals are idempotent.
 */
export async function removeConnection(
  userId: string,
  matchId: string,
): Promise<{ ok: true }> {
  const supabase = await createServerSupabaseClient()
  const { match, otherUserId } = await resolveMatchForParticipant(
    supabase,
    userId,
    matchId,
  )

  const { error } = await (supabase as unknown as LooseTable)
    .from('matches')
    .update({ status: 'declined' })
    .eq('id', matchId)
    .eq('status', match.status)
    .select('id')

  if (error) {
    logger.error('Relationship safety: remove connection failed', {
      matchId,
      userId,
      error: error.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to remove connection', {
      cause: error,
    })
  }

  // Read-model / cache invalidation for removal:
  // - per-user Next caches for BOTH participants (matches/discover/profile
  //   read models changed for both sides).
  // - no `blocks` row changed, so no block-cache invalidation applies.
  // - chat_threads is a DB-side projection and relationship momentum reads
  //   live rows — there is no relationship read-model cache to invalidate.
  invalidateUserCache(userId)
  invalidateUserCache(otherUserId)

  logger.info('Connection removed', {
    matchId,
    userId,
    otherUserId,
  })

  return { ok: true }
}
