// src/services/ideas/idea-relationship-context.ts
// ─────────────────────────────────────────────────────────────────────────────
// SESSION 34 — server resolver for the idea relationship loop's inputs.
//
// `getIdeaRelationshipContext(viewerId, ideaId)` returns ONLY authoritative
// booleans/rows the S34 prompt needs:
//
//   - interested: viewer validated (like/spark) OR is a member OR has a
//     pending request. Pure stored rows — never inferred.
//   - conversation: the most recent ACTIVE match-thread between the viewer
//     and the idea owner (matches + chat_threads projection). hasMessages /
//     isStale come from the thread's last-message fields; no thread or no
//     messages → null (never assumed).
//   - sharedContext: getMutualContext(viewer, owner) — real stored data only.
//
// Fail-safe: ANY lookup error degrades that input to its quiet default
// (interested=false, conversation=null, sharedContext=[]) — the loop stays
// quiet instead of inventing a connection.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  getMutualContext,
  type MutualContextItem,
} from '@/services/relationships/mutual-context'
import { MOMENTUM_THRESHOLDS } from '@/services/relationships/relationship-state'

export interface IdeaRelationshipContext {
  interested: boolean
  conversation: { hasMessages: boolean; isStale: boolean } | null
  sharedContext: MutualContextItem[]
}

const STALE_MS = MOMENTUM_THRESHOLDS.conversationGapHours * 3_600_000

export async function getIdeaRelationshipContext(
  viewerId: string,
  ideaId: string,
  ownerId: string,
): Promise<IdeaRelationshipContext> {
  const supabase = await createServerSupabaseClient()

  // ── interested: validation OR membership OR pending request ──
  let interested = false
  try {
    const [{ data: interest }, { data: membership }, { data: request }] =
      await Promise.all([
        supabase
          .from('idea_interests')
          .select('id')
          .eq('idea_id', ideaId)
          .eq('user_id', viewerId)
          .in('action', ['like', 'spark'])
          .limit(1)
          .maybeSingle(),
        supabase
          .from('team_memberships')
          .select('user_id')
          .eq('idea_id', ideaId)
          .eq('user_id', viewerId)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('join_requests')
          .select('id')
          .eq('idea_id', ideaId)
          .eq('user_id', viewerId)
          .eq('status', 'pending')
          .limit(1)
          .maybeSingle(),
      ])
    interested = Boolean(interest ?? membership ?? request)
  } catch (error) {
    logger.warn('Idea relationship: interest lookup failed — staying quiet', {
      ideaId,
      error,
    })
  }

  // ── conversation: latest ACTIVE match with the owner + its thread ──
  let conversation: IdeaRelationshipContext['conversation'] = null
  try {
    if (viewerId !== ownerId) {
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .or(
          `and(user1_id.eq.${viewerId},user2_id.eq.${ownerId}),and(user1_id.eq.${ownerId},user2_id.eq.${viewerId})`,
        )
        .limit(1)

      const matchId = (matches as Array<{ id: string }> | null)?.[0]?.id
      if (matchId) {
        const { data: thread } = await supabase
          .from('chat_threads')
          .select('last_message_at')
          .eq('match_id', matchId)
          .maybeSingle()

        const lastAt = (thread as { last_message_at: string | null } | null)
          ?.last_message_at
        if (lastAt) {
          const gapMs = Date.now() - Date.parse(lastAt)
          conversation = {
            hasMessages: true,
            isStale:
              Number.isFinite(gapMs) && gapMs >= 0 ? gapMs >= STALE_MS : false,
          }
        }
        // Thread row absent / no last message → null (no conversation known).
      }
    }
  } catch (error) {
    logger.warn(
      'Idea relationship: conversation lookup failed — staying quiet',
      { ideaId, error },
    )
    conversation = null
  }

  // ── shared context: real stored data only (permission-gated inside) ──
  let sharedContext: MutualContextItem[] = []
  try {
    if (viewerId !== ownerId) {
      sharedContext = await getMutualContext(viewerId, ownerId)
    }
  } catch (error) {
    logger.warn('Idea relationship: mutual context failed — staying quiet', {
      ideaId,
      error,
    })
    sharedContext = []
  }

  return { interested, conversation, sharedContext }
}
