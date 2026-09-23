// src/services/relationships/relationship-state.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-01 — Authoritative chat relationship-momentum state.
//
// Derives the conversation momentum state from authoritative server data
// (match status + chat_threads projection). No client-supplied "no reply"
// declaration is accepted; sender direction and time thresholds are explicit
// and testable so two clients viewing the same conversation always receive
// the same state.
//
// V10-BE-02 — Suggestion source typing: every suggestion declares its source
// category and is only generated when real backing data exists. Suggestion
// eligibility is a deterministic pure function of the authoritative state.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  MOMENTUM_THRESHOLDS,
  RELATIONSHIP_SUGGESTION_SOURCES,
  type RelationshipSuggestionSource,
} from '@/lib/chat/momentum'

export {
  MOMENTUM_THRESHOLDS,
  RELATIONSHIP_SUGGESTION_SOURCES,
  type RelationshipSuggestionSource,
} from '@/lib/chat/momentum'

import { assertThreadAccess, canMessageMatch } from '@/services/chat/access'
import { z } from 'zod'

// ─── Public contract ─────────────────────────────────────────────────────────

/** Canonical relationship momentum states (V10-BE-01). */
export type RelationshipMomentumState =
  | 'matched_no_messages'
  | 'awaiting_reply'
  | 'conversation_active'
  | 'next_action_eligible'

export interface RelationshipStateInput {
  /** Match status from the authoritative `matches` row. */
  matchStatus: string
  /** Number of messages in the thread (authoritative projection or count). */
  messageCount: number
  /** Sender id of the last message, if any. */
  lastMessageSenderId: string | null
  /** Timestamp of the last message, if any. */
  lastMessageAt: string | null
  /** Reference "now" (ISO). Injectable for deterministic tests. */
  now: string
}

export interface RelationshipSuggestion {
  source: RelationshipSuggestionSource
  /** Safe display data — never private rationale. */
  message: string
}

export interface RelationshipState {
  state: RelationshipMomentumState
  suggestion: RelationshipSuggestion | null
}

// ─── Pure derivation (unit-tested; no I/O) ───────────────────────────────────

function hoursBetween(earlierIso: string, laterIso: string): number {
  return (Date.parse(laterIso) - Date.parse(earlierIso)) / 3_600_000
}

/**
 * Deterministic momentum derivation for one conversation.
 *
 * Legal mapping (terminal-safe, mutually exclusive):
 * - non-messageable match (pending/declined) → never exposed here; callers
 *   gate on access first. Treated as "matched_no_messages" defensively.
 * - zero messages → matched_no_messages
 * - viewer sent the last message and threshold elapsed → awaiting_reply
 * - otherwise → conversation_active
 * - awaiting_reply past the conversation-gap threshold → next_action_eligible
 */
export function deriveRelationshipState(
  input: RelationshipStateInput,
): RelationshipState {
  const { matchStatus, messageCount, lastMessageSenderId, lastMessageAt, now } =
    input

  if (!canMessageMatch({ status: matchStatus }) || messageCount === 0) {
    return { state: 'matched_no_messages', suggestion: null }
  }

  // The caller passes an opaque sender direction marker: "viewer" | "other".
  // (The service layer maps real sender ids to this marker before calling.)
  const lastSentByViewer = lastMessageSenderId === 'viewer'

  if (lastSentByViewer && lastMessageAt) {
    const hours = hoursBetween(lastMessageAt, now)

    // Fail-to-safe: an unparseable/absent timestamp must never surface as
    // "awaiting_reply" — both clients still derive the identical state.
    if (
      Number.isFinite(hours) &&
      hours >= MOMENTUM_THRESHOLDS.awaitingReplyHours
    ) {
      const suggestion: RelationshipSuggestion =
        hours >= MOMENTUM_THRESHOLDS.conversationGapHours
          ? {
              source: 'conversation_gap',
              message:
                "It's been a while since you reached out — send a friendly follow-up.",
            }
          : {
              source: 'conversation_gap',
              message: 'Waiting on a reply — a gentle nudge can help.',
            }

      return {
        state:
          hours >= MOMENTUM_THRESHOLDS.conversationGapHours
            ? 'next_action_eligible'
            : 'awaiting_reply',
        suggestion,
      }
    }
  }

  return { state: 'conversation_active', suggestion: null }
}

// ─── Service layer (authoritative reads) ─────────────────────────────────────

interface ThreadRow {
  match_id: string
  last_message_sender_id: string | null
  last_message_at: string | null
}

/**
 * Load the authoritative relationship state for a conversation.
 *
 * Actor comes from the trusted auth context (the caller passes the resolved
 * userId — never a client-controlled body/query field for the target).
 * Access gating reuses the canonical chat gate (W3.6): 404 for a missing
 * match, 403 for a non-participant, and 403 for a non-active (pending /
 * declined) match — so a forged matchId can never read another user's
 * relationship state or expose momentum for an unmatchable thread.
 */
export async function getRelationshipState(
  userId: string,
  matchId: string,
): Promise<RelationshipState> {
  const supabase = await createServerSupabaseClient()

  const match = await assertThreadAccess(supabase, userId, matchId)

  // chat_threads is the transactional projection (migration 20260906160000).
  // It carries the last-message fields; message count comes from the durable
  // messages table (bounded, indexed by messages(match_id, created_at)).
  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('match_id, last_message_sender_id, last_message_at')
    .eq('match_id', matchId)
    .maybeSingle()

  if (threadError) {
    logger.warn('Relationship state: thread projection unavailable', {
      matchId,
      error: threadError.message,
    })
  }

  const threadRow = (thread ?? null) as unknown as ThreadRow | null

  const { count: messageCount, error: countError } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)

  if (countError) {
    logger.error('Relationship state: message count failed', {
      matchId,
      error: countError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load relationship', {
      cause: countError,
    })
  }

  const lastMessageSenderId = threadRow?.last_message_sender_id ?? null
  const directionMarker =
    lastMessageSenderId === null
      ? null
      : lastMessageSenderId === userId
        ? 'viewer'
        : 'other'

  const state = deriveRelationshipState({
    matchStatus: match.status,
    messageCount: messageCount ?? 0,
    lastMessageSenderId: directionMarker,
    lastMessageAt: threadRow?.last_message_at ?? null,
    now: new Date().toISOString(),
  })

  return state
}

// ─── Dismissed suggestions (user-scoped, idempotent) ─────────────────────────

const dismissalSourceSchema = z.enum(RELATIONSHIP_SUGGESTION_SOURCES)

/**
 * Persist that the viewer dismissed a suggestion for this conversation.
 * Idempotent: repeated dismissals converge to one row via the DB unique
 * constraint (user_id, match_id, source). Identity comes from the trusted
 * auth context only.
 */
export async function dismissSuggestion(
  userId: string,
  matchId: string,
  source: RelationshipSuggestionSource,
): Promise<void> {
  dismissalSourceSchema.parse(source)

  const supabase = await createServerSupabaseClient()

  // Re-assert participation before writing; the table's own FK/RLS also
  // constrain user_id to auth.uid(), but the service validates the
  // user→match relationship explicitly.
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id')
    .eq('id', matchId)
    .maybeSingle()

  if (matchError) {
    logger.error('Suggestion dismiss: match lookup failed', {
      matchId,
      error: matchError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to dismiss suggestion', {
      cause: matchError,
    })
  }

  const matchRow = match as unknown as {
    id: string
    user1_id: string
    user2_id: string
  } | null

  if (!matchRow) {
    throw AppError.notFound('Match', matchId)
  }

  if (matchRow.user1_id !== userId && matchRow.user2_id !== userId) {
    throw AppError.forbidden('You are not a participant in this thread.')
  }

  const { error: upsertError } = await supabase
    .from('relationship_suggestion_dismissals')
    .upsert(
      { user_id: userId, match_id: matchId, source },
      { onConflict: 'user_id,match_id,source', ignoreDuplicates: true },
    )

  if (upsertError) {
    logger.error('Suggestion dismiss: upsert failed', {
      matchId,
      userId,
      error: upsertError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to dismiss suggestion', {
      cause: upsertError,
    })
  }
}
