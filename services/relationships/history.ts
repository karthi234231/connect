// src/services/relationships/history.ts
// ─────────────────────────────────────────────────────────────────────────────
// P0-11 — Relationship history read model (spec §140.4).
//
// §140.4 requires a compact, auditable history of relationship transitions:
// created → accepted → message started → call scheduled → group joined →
// contribution → relationship ended.
//
// `match_timeline` is the durable writer-owned table (init migration +
// 20260916000000 completing the enum). This module only READS it, for one
// match the caller is a verified participant in — authorization is delegated to
// the canonical `assertThreadAccess` gate so a history view can never widen
// access to a thread.
//
// Fail-safe: an unreadable event type is skipped, never guessed. An empty
// history returns [], and callers omit the section (no fabricated rows, no
// placeholder milestones).
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { assertThreadAccess } from '@/services/chat/access'
// The vocabulary/parser/label map live in the client-safe pure module — ONE
// source of truth shared by this server read model and the client view (no
// drift, no duplicated enum).
import {
  parseRelationshipHistory,
  type RelationshipHistoryEntry,
} from '@/lib/relationships/history'

// Re-exported so existing server-side callers keep one import path.
export {
  RELATIONSHIP_HISTORY_EVENTS,
  isRelationshipHistoryEvent,
  parseRelationshipHistory,
  relationshipHistoryLabel,
} from '@/lib/relationships/history'
export type {
  RelationshipHistoryEntry,
  RelationshipHistoryEvent,
} from '@/lib/relationships/history'

// ─── Read (participant-only) ─────────────────────────────────────────────────────

/**
 * Load the relationship history for one match. Throws NOT_FOUND/FORBIDDEN via
 * the shared thread-access gate exactly like every other match-scoped read, so
 * a non-participant gains nothing from this endpoint.
 */
export async function getRelationshipHistory(
  userId: string,
  matchId: string,
): Promise<RelationshipHistoryEntry[]> {
  const supabase = await createServerSupabaseClient()

  await assertThreadAccess(supabase, userId, matchId)

  const { data, error } = await supabase
    .from('match_timeline')
    .select('id, event_type, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    logger.error('Relationship history: query failed', {
      matchId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load relationship', {
      cause: error,
    })
  }

  return parseRelationshipHistory(
    (data ?? []) as unknown as Array<{
      id?: unknown
      event_type?: unknown
      created_at?: unknown
    }>,
  )
}
