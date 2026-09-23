// src/services/matching/match.service.ts

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { AppError, ErrorCodes } from '@/lib/errors'
import { swipeResultSchema, swipeSchema } from './swipe.schema'
import { requestIntroSchema } from './request-intro.schema'
import { getNotificationsService } from '@/services/notifications'
import { trackFunnel, FunnelEvents } from '@/lib/analytics/funnel'
import { invalidateUserCache } from '@/lib/cache'
import { rowToProfile, type Profile } from '@/services/profiles/mappers'
import { isMatchReason, matchReasonLabel } from '@/services/matching/reasons'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Match {
  id: string
  user1Id: string
  user2Id: string
  status: 'pending' | 'active' | 'declined'
  score: number | null
  createdAt: string
  updatedAt: string
}

type MatchStatus = 'pending' | 'active' | 'declined'

interface MatchRow {
  id: string
  user1_id: string
  user2_id: string
  status: MatchStatus
  score: number | null
  created_at: string
  updated_at: string
}

interface ProfileJoinRow {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

interface MatchWithProfilesRow {
  id: string
  status: MatchStatus
  score: number | null
  created_at: string
  user1_id: string
  user2_id: string
  user1: ProfileJoinRow | null
  user2: ProfileJoinRow | null
}

interface LastMessageRow {
  content: string
  created_at: string
  sender_id: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getMatchAndVerify(
  matchId: string,
  userId: string,
): Promise<MatchRow> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, status, score, created_at, updated_at')
    .eq('id', matchId)
    .single()

  if (error || !data) {
    logger.error('Match not found', {
      matchId,
      error: error?.message,
    })

    throw new AppError(ErrorCodes.NOT_FOUND, 'Match not found')
  }

  const typedMatch = data as unknown as MatchRow

  if (typedMatch.user1_id !== userId && typedMatch.user2_id !== userId) {
    logger.warn('User not participant in match', {
      matchId,
      userId,
    })

    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'You are not a participant in this match',
    )
  }

  return typedMatch
}

// ─────────────────────────────────────────────────────────────────────────────
// Get Matches
// ─────────────────────────────────────────────────────────────────────────────

export async function getMatches(userId: string): Promise<
  Array<{
    matchId: string
    otherUser: {
      id: string
      fullName: string
      role: string
      avatarUrl?: string
    }
    status: MatchStatus
    createdAt: string
    lastMessage?: {
      content: string
      createdAt: string
      senderId: string
    }
    unreadCount: number
    /** Real "why you matched" from the user's stored recommendation (S42). */
    matchReason?: string
    /**
     * Real `matches.score` (0-100) or null when the DB has none (§77/§192:
     * ordering input only — never rendered raw in the UI).
     */
    score: number | null
    /** Latest real thread activity: last message time, else the match time. */
    lastActivityAt: string
    /**
     * True when the viewer's own stored recommendation records that they
     * swiped right (action 'like' | 'spark') for this candidate, i.e. the
     * viewer initiated the match rather than only reciprocated it.
     */
    initiatedByViewer: boolean
  }>
> {
  const supabase = await createServerSupabaseClient()

  const { data: matches, error } = await supabase
    .from('matches')
    .select(
      `
        id,
        status,
        score,
        created_at,
        user1_id,
        user2_id,
        user1:profiles!matches_user1_id_fkey (
          id,
          full_name,
          role,
          avatar_url
        ),
        user2:profiles!matches_user2_id_fkey (
          id,
          full_name,
          role,
          avatar_url
        )
      `,
    )
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    logger.error('Failed to fetch matches', {
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to fetch matches', {
      cause: error,
    })
  }

  const typedMatches = (matches ?? []) as unknown as MatchWithProfilesRow[]

  if (typedMatches.length === 0) {
    return []
  }

  const matchIds = typedMatches.map((m) => m.id)

  // S040 — batched projection (3 queries total, no per-row fetch):
  // 1) matches + profiles (above), 2) latest message per match, 3) unread rows.
  // Both follow-ups are covered by messages(match_id, created_at) and
  // messages_unread_inbox_idx (partial, read_at is null) from S031.
  const { data: recentMessages, error: recentError } = await supabase
    .from('messages')
    .select('match_id, content, created_at, sender_id')
    .in('match_id', matchIds)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (recentError) {
    logger.warn('Failed to batch last messages', {
      error: recentError.message,
    })
  }

  // First occurrence per match in descending order = latest message.
  const lastMessageByMatch = new Map<
    string,
    LastMessageRow & { match_id: string }
  >()
  for (const row of (recentMessages ?? []) as unknown as Array<
    LastMessageRow & { match_id: string }
  >) {
    if (!lastMessageByMatch.has(row.match_id)) {
      lastMessageByMatch.set(row.match_id, row)
    }
  }

  const { data: unreadRows, error: unreadError } = await supabase
    .from('messages')
    .select('match_id')
    .in('match_id', matchIds)
    .neq('sender_id', userId)
    .is('read_at', null)
    .limit(2000)

  if (unreadError) {
    logger.warn('Failed to batch unread counts', {
      error: unreadError.message,
    })
  }

  const unreadByMatch = new Map<string, number>()
  for (const row of (unreadRows ?? []) as unknown as Array<{
    match_id: string
  }>) {
    unreadByMatch.set(row.match_id, (unreadByMatch.get(row.match_id) ?? 0) + 1)
  }

  const otherUserIds = typedMatches
    .map((match) => (match.user1_id === userId ? match.user2 : match.user1))
    .map((profile) => profile?.id)
    .filter((id): id is string => Boolean(id))

  const reasonsByCandidate = new Map<string, string>()
  const initiatedByViewer = new Set<string>()

  if (otherUserIds.length > 0) {
    const { data: recRows, error: recError } = await supabase
      .from('recommendations')
      .select('candidate_id, reasons, action')
      .eq('user_id', userId)
      .in('candidate_id', otherUserIds)

    if (recError) {
      logger.warn('Failed to batch match reasons', {
        error: recError.message,
      })
    }

    for (const row of (recRows ?? []) as unknown as Array<{
      candidate_id: string
      reasons: unknown
      action: unknown
    }>) {
      // P0-11 — the viewer initiated iff their own stored outcome was a
      // right-swipe. 'pass' can coexist with a match row (the other side later
      // swiped right, or the pass was superseded), so it must NOT count.
      if (row.action === 'like' || row.action === 'spark') {
        initiatedByViewer.add(row.candidate_id)
      }

      if (reasonsByCandidate.has(row.candidate_id)) continue

      // S16A — persisted reasons are now structured facts. Read the first, in
      // either shape (legacy string or structured MatchReason), into its label.
      const first = Array.isArray(row.reasons) ? row.reasons[0] : undefined
      if (typeof first === 'string') {
        reasonsByCandidate.set(row.candidate_id, first)
      } else if (isMatchReason(first)) {
        reasonsByCandidate.set(row.candidate_id, matchReasonLabel(first))
      }
    }
  }

  const results = await Promise.all(
    typedMatches.map(async (match) => {
      const isUser1 = match.user1_id === userId

      const otherUser = isUser1 ? match.user2 : match.user1

      if (!otherUser) {
        logger.warn('Other user profile missing', {
          matchId: match.id,
          userId,
        })

        throw new AppError(
          ErrorCodes.INTERNAL,
          'Failed to load matched user profile',
        )
      }

      const lastMessage = lastMessageByMatch.get(match.id) ?? null

      return {
        matchId: match.id,
        otherUser: {
          id: otherUser.id,
          fullName: otherUser.full_name,
          role: otherUser.role,
          ...(otherUser.avatar_url
            ? {
                avatarUrl: otherUser.avatar_url,
              }
            : {}),
        },
        status: match.status,
        createdAt: match.created_at,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.created_at,
              senderId: lastMessage.sender_id,
            }
          : undefined,
        unreadCount: unreadByMatch.get(match.id) ?? 0,
        matchReason: reasonsByCandidate.get(otherUser.id),
        score: typeof match.score === 'number' ? match.score : null,
        lastActivityAt: lastMessage?.created_at ?? match.created_at,
        initiatedByViewer: initiatedByViewer.has(otherUser.id),
      }
    }),
  )

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Match Detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getMatchById(
  userId: string,
  matchId: string,
): Promise<{
  match: {
    id: string
    status: MatchStatus
    createdAt: string
    /** Real `matches.score` or null (§77/§192: never rendered raw). */
    score: number | null
    /**
     * True when the viewer's own stored recommendation shows they swiped right
     * ('like' | 'spark') for this candidate.
     */
    initiatedByViewer: boolean
  }
  otherUser: Profile
} | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id, status, score, created_at')
    .eq('id', matchId)
    .single()

  if (error || !data) {
    logger.warn('Match detail not found', {
      matchId,
      userId,
      error: error?.message,
    })

    return null
  }

  const typed = data as unknown as {
    id: string
    user1_id: string
    user2_id: string
    status: MatchStatus
    score: number | null
    created_at: string
  }

  // S43 — unrelated match IDs must not resolve (return not-found, never leak).
  if (typed.user1_id !== userId && typed.user2_id !== userId) {
    logger.warn('User not participant in match', {
      matchId,
      userId,
    })

    return null
  }

  const otherUserId =
    typed.user1_id === userId ? typed.user2_id : typed.user1_id

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    // #90 — match-safe projection: only fields rowToProfile maps; never fetch
    // moderation/security columns (suspended_at, app_role) at DB level. The
    // Profile DTO additionally never carries email/phone/account settings.
    .select(
      'id, full_name, role, bio, skills, availability, timezone, looking_for, visibility, avatar_url, commitment_level, work_style, last_active_at, created_at, updated_at, onboarding_status, onboarding_completed_at',
    )
    .eq('id', otherUserId)
    .single()

  if (profileError || !profileRow) {
    logger.warn('Match detail profile missing', {
      matchId,
      otherUserId,
      error: profileError?.message,
    })

    return null
  }

  // P0-11 — did the viewer initiate? Only a stored right-swipe by the viewer
  // counts; no heuristic and no other-side inference (§360.2).
  const { data: ownOutcome, error: outcomeError } = await supabase
    .from('recommendations')
    .select('action')
    .eq('user_id', userId)
    .eq('candidate_id', otherUserId)
    .maybeSingle()

  if (outcomeError) {
    logger.warn('Match detail outcome lookup failed', {
      matchId,
      error: outcomeError.message,
    })
  }

  const ownAction = (ownOutcome as unknown as { action?: unknown } | null)
    ?.action

  return {
    match: {
      id: typed.id,
      status: typed.status,
      createdAt: typed.created_at,
      score: typeof typed.score === 'number' ? typed.score : null,
      initiatedByViewer: ownAction === 'like' || ownAction === 'spark',
    },
    otherUser: rowToProfile(profileRow),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Swipe
// ─────────────────────────────────────────────────────────────────────────────

export async function performSwipe(
  userId: string,
  candidateId: string,
  action: 'like' | 'pass' | 'spark',
): Promise<{
  matchCreated: boolean
  matchId?: string
  /**
   * P0-10 — server-authoritative quota remainder from the RPC
   * (`quota_remaining`). Null when the RPC shape predates the quota column.
   */
  quotaRemaining: number | null
}> {
  const supabase = await createServerSupabaseClient()

  // NOTE — match.service.performSwipe is the DB-MUTATION seam only. The S17
  // input contract (recommendationId + clientIntentId + snapshot verification)
  // lives at the action boundary (app/actions/swipe.ts), which validates the
  // full strict schema BEFORE calling this seam. Re-validating the full swipe
  // schema HERE would be both wrong (this seam receives raw DB args, not the
  // wire form) and redundant — keep only the field-level guards this seam owns.
  swipeSchema
    .pick({ candidateId: true, action: true })
    .parse({ candidateId, action })

  if (userId === candidateId) {
    throw new AppError(ErrorCodes.VALIDATION, 'You cannot swipe on yourself')
  }

  // S02-TODO-B — the swipe-record + reciprocal-check + match-create + timeline
  // sequence is a single Postgres transaction (RPC), so it can't interleave
  // with a concurrent swipe or half-complete on error. The RPC is SECURITY
  // DEFINER (pinned search_path, auth.uid() captured + validated, writes
  // scoped to the caller) because the reciprocal check must read the other
  // user's recommendation row, which RLS correctly hides from clients.
  // HOST-DB-02 — the score is derived server-side by the RPC from
  // recommendation_scores; it is never supplied by the caller.
  const { data, error } = await supabase.rpc('perform_swipe', {
    p_action: action,
    p_candidate_id: candidateId,
  })

  if (error) {
    logger.error('Failed to persist swipe action', {
      userId,
      candidateId,
      action,
      error: error.message,
    })

    // Stale-candidate revalidation failed inside the RPC: the candidate is
    // blocked (either direction) or no longer discoverable.
    if (error.message === 'candidate_unavailable') {
      throw new AppError(
        ErrorCodes.VALIDATION,
        'This candidate is no longer available',
      )
    }

    // P0-10 — the transactional quota gate rejected this like/spark: today's
    // 10 introductions are spent. Wire code MATCH_RIGHT_SWIPES_EXHAUSTED carries
    // the spec §1213 copy to the client.
    if (error.message === 'quota_exhausted') {
      throw new AppError(
        ErrorCodes.QUOTA_EXHAUSTED,
        'Daily right-swipe limit reached.',
      )
    }

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to record swipe action', {
      cause: error,
    })
  }

  const result = swipeResultSchema.safeParse(data)

  if (!result.success) {
    logger.error('perform_swipe returned an unexpected shape', {
      userId,
      candidateId,
      data,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to record swipe action')
  }

  // Quota remainder flows through on EVERY outcome (match or not) — the
  // client renders "N left today" from this server number, never its own.
  const quotaRemaining = result.data.quota_remaining ?? null

  if (!result.data.match_created || !result.data.match_id) {
    return {
      matchCreated: false,
      matchId: result.data.match_id ?? undefined,
      quotaRemaining,
    }
  }

  const matchId = result.data.match_id

  await trackFunnel({
    eventName: FunnelEvents.MatchCreated,
    actorId: userId,
    entityType: 'match',
    entityId: matchId,
    surface: 'discover_feed',
  })

  logger.info('Match created', {
    matchId,
    userId,
    candidateId,
  })

  // Both users' matches + discover feed content changed: invalidate so the
  // next read does not serve stale matches/discover entries.
  invalidateUserCache(userId)
  invalidateUserCache(candidateId)

  return {
    matchCreated: true,
    matchId,
    quotaRemaining,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Accept Match
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptMatch(
  userId: string,
  matchId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const match = await getMatchAndVerify(matchId, userId)

  if (match.status !== 'pending') {
    throw new AppError(ErrorCodes.VALIDATION, 'Match is not pending')
  }

  // #37: accept + timeline entry are one Postgres transaction (RPC) — a
  // failure can no longer leave an accepted match without its timeline event.
  // The conditional transition lives in the RPC's WHERE clause, so the
  // concurrent-accept/decline race (#35/#36) stays closed.
  const { error } = await supabase.rpc('sp_accept_match', {
    p_match_id: matchId,
  })

  if (error) {
    if (error.message === 'match_not_pending') {
      throw new AppError(ErrorCodes.VALIDATION, 'Match is not pending')
    }
    logger.error('Failed to accept match', {
      matchId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to accept match', {
      cause: error,
    })
  }

  logger.info('Match accepted', {
    matchId,
    userId,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Decline Match
// ─────────────────────────────────────────────────────────────────────────────

export async function declineMatch(
  userId: string,
  matchId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const match = await getMatchAndVerify(matchId, userId)

  if (match.status !== 'pending') {
    throw new AppError(ErrorCodes.VALIDATION, 'Match is not pending')
  }

  // S02-TODO-B: same conditional transition as acceptMatch — only one of
  // accept/decline can win from `pending`; the loser gets a validation error
  // instead of silently overwriting the winner's outcome.
  const { data: updated, error } = await supabase
    .from('matches')
    .update({
      status: 'declined',
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    logger.error('Failed to decline match', {
      matchId,
      userId,
      error: error.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to decline match', {
      cause: error,
    })
  }

  if (!updated || updated.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION, 'Match is not pending')
  }

  logger.info('Match declined', {
    matchId,
    userId,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Intro
// ─────────────────────────────────────────────────────────────────────────────

export async function requestIntro(
  userId: string,
  matchId: string,
  message: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  requestIntroSchema.parse({
    matchId,
    message,
  })

  const match = await getMatchAndVerify(matchId, userId)

  if (match.status !== 'active') {
    throw new AppError(ErrorCodes.VALIDATION, 'Match is not active')
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [match.user1_id, match.user2_id])

  if (profilesError || !profiles || profiles.length < 2) {
    logger.error('Failed to fetch profiles for intro', {
      matchId,
      error: profilesError?.message,
    })

    throw new AppError(ErrorCodes.INTERNAL, 'Failed to send intro', {
      cause: profilesError,
    })
  }

  const typedProfiles = profiles as unknown as Array<{
    id: string
    full_name: string
  }>

  const nameMap = Object.fromEntries(
    typedProfiles.map((profile) => [profile.id, profile.full_name]),
  )

  // HOST-ASYNC-02 — email delivery is now entirely the durable notification
  // worker's responsibility (it owns the recipient lookup + Resend call via the
  // notification_deliveries outbox). We do not need the sender/recipient
  // email strings here anymore.
  const recipientId =
    userId === match.user1_id ? match.user2_id : match.user1_id

  const senderName = nameMap[userId]

  await supabase.from('match_timeline').insert({
    match_id: matchId,
    event_type: 'intro_requested',
    meta: {
      requested_by: userId,
      message_preview: message.slice(0, 50),
    },
  })

  // HOST-ASYNC-02 — the intro intent is now durable (timeline row above); the
  // external email is delivered exclusively by the durable notification
  // worker. We record an `intro_requested` notification + enqueue an email
  // delivery via the durable outbox (notification_deliveries), never by
  // calling Resend inline. The dedupeKey (scoped to the match) makes retries
  // idempotent: DB-enforced partial unique index (user_id, dedupe_key) means
  // a repeated requestIntro for the same match inserts at most one
  // notification row, so the worker can never re-fire a duplicate external
  // email.
  await getNotificationsService().notify(recipientId, {
    type: 'intro_requested',
    entityType: 'match',
    entityId: matchId,
    title: `${senderName ?? 'Someone'} would like an introduction`,
    body: message.slice(0, 500),
    dedupeKey: `intro_requested:${matchId}`,
  })

  logger.info('Intro requested', {
    matchId,
    userId,
  })
}
