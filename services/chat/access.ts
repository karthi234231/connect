// src/services/chat/access.ts
// ─────────────────────────────────────────────────────────────────────────────
// W3.6 — `assertThreadAccess` chat guard + hidden-identity projection.
//
// Chat is a release blocker (§7.6): it must be inaccessible before a match is
// approved/active. This module centralizes the repeated "verify participant"
// boilerplate that was duplicated across send/getMessages/markRead and fails
// closed.
//
// `assertThreadAccess` throws AppError(403) for non-participants and
// AppError(404) when the match doesn't exist.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>

interface MatchAccessRow {
  id: string
  user1_id: string
  user2_id: string
  status: string
}

/** Pure predicate: is the given user a participant of the match? */
export function isMatchParticipant(
  match: {
    user1_id?: string
    user2_id?: string
  },
  userId: string,
): boolean {
  return match.user1_id === userId || match.user2_id === userId
}

/** Pure function: the other endpoint of a match. Call after participant gate. */
export function otherParticipantId(
  match: {
    user1_id?: string
    user2_id?: string
  },
  userId: string,
): string {
  return match.user1_id === userId
    ? (match.user2_id ?? '')
    : (match.user1_id ?? '')
}

/** Statuses in which messaging is permitted (S030: only active matches). */
export const MESSAGEABLE_MATCH_STATUSES: readonly string[] = ['active']

/** Pure predicate: is the match in a state that permits messaging? */
export function canMessageMatch(match: { status?: string }): boolean {
  return match.status === 'active'
}

/**
 * Verify the caller may read/write a thread.
 *
 * Returns the match row so callers can reuse it without another database
 * request.
 *
 * Throws:
 * - 404 when the match does not exist
 * - 403 when the user is not a participant
 * - 403 when the match is not active/pending
 */
export async function assertThreadAccess(
  supabase: ServerSupabase,
  userId: string,
  matchId: string,
): Promise<MatchAccessRow> {
  const { data: match, error } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, status')
    .eq('id', matchId)
    .single()

  if (error || !match) {
    logger.warn('Thread access: match not found', {
      matchId,
      error: error?.message,
    })

    throw AppError.notFound('Match', matchId)
  }

  // Supabase can expose untyped query fields as `unknown` depending on the
  // generated Database type configuration. Normalize the row once here.
  const typedMatch = match as unknown as MatchAccessRow

  if (!isMatchParticipant(typedMatch, userId)) {
    logger.warn('Thread access denied: not a participant', {
      matchId,
      userId,
    })

    throw AppError.forbidden('You are not a participant in this thread.')
  }

  if (!canMessageMatch(typedMatch)) {
    logger.warn('Thread access denied: match not active', {
      matchId,
      userId,
      status: typedMatch.status,
    })

    throw AppError.forbidden('This thread is not active.')
  }

  return typedMatch
}

/**
 * Convenience wrapper that creates the server client and asserts access.
 *
 * Returns the match id, ready for callers.
 */
export async function assertThreadAccessForUser(
  userId: string,
  matchId: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient()

  const match = await assertThreadAccess(supabase, userId, matchId)

  return match.id
}
