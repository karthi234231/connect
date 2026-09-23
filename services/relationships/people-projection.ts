// src/services/relationships/people-projection.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-08 / V10-BE-09 — shared person → relationship/chat projection.
//
// SINGLE AUTHORITY for converting a list of target user ids into per-person
// cards of the shape { userId, publicProfileProjection, relationshipState,
// chatTargetState }. Events, Ideas and any future surface MUST call this
// helper instead of re-deriving relationship logic locally.
//
// Safety / privacy invariants:
// - Blocked pairs are excluded BEFORE anything else (read-only reuse of the
//   batched canonical filter in @/services/safety), so a blocked target never
//   leaks a profile card or a chat target.
// - The public profile projection is built with the canonical profile mapper
//   (`rowToProfile`) from @/services/profiles — the same mapper Mini 4's
//   `getPublicProfile` uses. Never a raw SELECT *; no email/contact columns.
// - Chat-target + momentum state are derived from canonical `matches` /
//   `chat_threads` and the pure `deriveRelationshipState`. A single-target
//   projection reuses the canonical per-match service `getRelationshipState`.
// - Reads are batched (chunked IN queries, no N+1 loop).
// ─────────────────────────────────────────────────────────────────────────────

import type { Tables } from '@/types/database'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { rowToProfile, type Profile } from '@/services/profiles/mappers'
import { filterBlockedCandidates } from '@/services/safety/safety.service'
import {
  deriveRelationshipState,
  getRelationshipState,
  type RelationshipState,
} from './relationship-state'
import { canMessageMatch } from '@/services/chat/access'

export type PublicProfileProjection = Profile

export const PEOPLE_PROJECTION_BATCH_SIZE = 100

/** Canonical chat thread route (matches the app router). */
export const CHAT_ROUTE = '/dashboard/chat'
export const chatRouteFor = (matchId: string): string =>
  `${CHAT_ROUTE}/${encodeURIComponent(matchId)}`

export interface ChatTargetState {
  matchId: string
  status: 'active'
  canMessage: true
  destination: string
}

export interface PeopleProjection {
  userId: string
  publicProfileProjection: PublicProfileProjection | null
  relationshipState: RelationshipState | null
  chatTargetState: ChatTargetState | null
}

// ─── Row shapes (narrow projections of canonical tables) ────────────────────

export interface MatchProbeRow {
  id: string
  user1_id: string
  user2_id: string
  status: string
}

export interface ThreadProbeRow {
  match_id: string
  last_message_id: string | null
  last_message_sender_id: string | null
  last_message_at: string | null
}

// ─── Injectable data access (defaults are the canonical services) ───────────

export interface PeopleProjectionDao {
  loadPublicProfiles(userIds: string[]): Promise<Array<Record<string, unknown>>>
  loadActiveMatchByTarget(
    viewerId: string,
    targetIds: string[],
  ): Promise<MatchProbeRow[]>
  loadThreads(matchIds: string[]): Promise<ThreadProbeRow[]>
  resolveRelationshipState(
    userId: string,
    matchId: string,
  ): Promise<RelationshipState>
  /** Returns the subset of targetIds that are NOT blocked for the viewer. */
  filterBlocked(viewerId: string, targetIds: string[]): Promise<string[]>
}

function chunk<T>(values: T[], size = PEOPLE_PROJECTION_BATCH_SIZE): T[][] {
  const groups: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    groups.push(values.slice(i, i + size))
  }
  return groups
}

/** Canonical public profile columns — identical to getPublicProfile. */
const PUBLIC_PROFILE_COLUMNS =
  'id, full_name, role, bio, skills, availability, timezone, looking_for, visibility, avatar_url, last_active_at'

export function createPeopleProjectionDao(
  client?: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): PeopleProjectionDao {
  return {
    async loadPublicProfiles(userIds) {
      const supabase = client ?? (await createServerSupabaseClient())
      const rows: Array<Record<string, unknown>> = []
      for (const group of chunk(userIds)) {
        const { data, error } = await supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .in('id', group)
        if (error) throw error
        rows.push(...((data ?? []) as Array<Record<string, unknown>>))
      }
      return rows
    },

    async loadActiveMatchByTarget(viewerId, targetIds) {
      const supabase = client ?? (await createServerSupabaseClient())
      const rows: MatchProbeRow[] = []
      for (const group of chunk(targetIds)) {
        const { data, error } = await supabase
          .from('matches')
          .select('id, user1_id, user2_id, status')
          .in('status', ['active'])
          .or(
            `and(user1_id.eq.${viewerId},user2_id.in.(${group.join(',')})),` +
              `and(user2_id.eq.${viewerId},user1_id.in.(${group.join(',')}))`,
          )
        if (error) throw error
        rows.push(...((data ?? []) as unknown as MatchProbeRow[]))
      }
      return rows
    },

    async loadThreads(matchIds) {
      const supabase = client ?? (await createServerSupabaseClient())
      const rows: ThreadProbeRow[] = []
      for (const group of chunk(matchIds)) {
        const { data, error } = await supabase
          .from('chat_threads')
          .select(
            'match_id, last_message_id, last_message_sender_id, last_message_at',
          )
          .in('match_id', group)
        if (error) throw error
        rows.push(...((data ?? []) as unknown as ThreadProbeRow[]))
      }
      return rows
    },

    resolveRelationshipState(userId, matchId) {
      return getRelationshipState(userId, matchId)
    },

    async filterBlocked(viewerId, targetIds) {
      const kept: string[] = []
      for (const group of chunk(targetIds)) {
        const remaining = await filterBlockedCandidates(
          viewerId,
          group.map((id) => ({ id })),
        )
        kept.push(...remaining.map((candidate) => candidate.id))
      }
      return kept
    },
  }
}

// ─── Pure derivation helpers ─────────────────────────────────────────────────

function emptyProjection(userId: string): PeopleProjection {
  return {
    userId,
    publicProfileProjection: null,
    relationshipState: null,
    chatTargetState: null,
  }
}

/**
 * Exact chat target for an active match. `canMessageMatch` is the canonical
 * access predicate from @/services/chat — messaging only exists on `active`.
 */
export function deriveChatTargetState(
  match: Pick<MatchProbeRow, 'id' | 'status'>,
): ChatTargetState | null {
  if (!canMessageMatch({ status: match.status })) return null
  return {
    matchId: match.id,
    status: 'active',
    canMessage: true,
    destination: chatRouteFor(match.id),
  }
}

export interface ProjectPeopleOptions {
  dao?: PeopleProjectionDao
  /** Injectable "now" for deterministic momentum derivation. */
  now?: string
}

/**
 * Build { userId, publicProfileProjection, relationshipState, chatTargetState }
 * for each non-blocked target. Same viewer-id may appear in targetIds (ver a
 * self-card never yields a chat target).
 */
export async function projectPeople(
  viewerId: string | null,
  targetIds: string[],
  options: ProjectPeopleOptions = {},
): Promise<PeopleProjection[]> {
  const dao = options.dao ?? createPeopleProjectionDao()
  const uniqueIds = Array.from(
    new Set(targetIds.filter((id) => Boolean(id && id.trim()))),
  )

  if (uniqueIds.length === 0) return []

  // 1) Safety gate FIRST: a blocked pair is invisible, never a degraded card.
  let allowedIds = uniqueIds
  if (viewerId) {
    allowedIds = await dao.filterBlocked(viewerId, uniqueIds)
  }
  if (allowedIds.length === 0) return []

  const byId = new Map<string, PeopleProjection>(
    allowedIds.map((id) => [id, emptyProjection(id)]),
  )

  // 2) Canonical public profile projection (Mini 4 mapper) — batched IN.
  const profileRows = await dao.loadPublicProfiles(allowedIds)
  for (const row of profileRows) {
    const profile = rowToProfile(row as Partial<Tables<'profiles'>>)
    const entry = byId.get(profile.id)
    if (entry) entry.publicProfileProjection = profile
  }

  // 3) Match / chat target — only meaningful for an authenticated viewer.
  if (viewerId) {
    const matchRows = await dao.loadActiveMatchByTarget(viewerId, allowedIds)

    // The pair-transition migration guarantees at most one active match per
    // pair; the first match per target is authoritative.
    const matchByTarget = new Map<string, MatchProbeRow>()
    for (const match of matchRows) {
      const other =
        match.user1_id === viewerId ? match.user2_id : match.user1_id
      if (other && byId.has(other) && !matchByTarget.has(other)) {
        matchByTarget.set(other, match)
      }
    }

    if (matchByTarget.size > 0) {
      if (allowedIds.length === 1 && matchByTarget.size === 1) {
        // Single-target projection reuses the canonical per-match service.
        const target = Array.from(matchByTarget.keys())[0]
        const match = matchByTarget.get(target)!
        const entry = byId.get(target)!
        entry.chatTargetState = deriveChatTargetState(match)
        entry.relationshipState = await dao.resolveRelationshipState(
          viewerId,
          match.id,
        )
      } else {
        const matchIds = Array.from(
          new Set(Array.from(matchByTarget.values()).map((m) => m.id)),
        )
        const threadRows = await dao.loadThreads(matchIds)
        const threadByMatch = new Map(threadRows.map((t) => [t.match_id, t]))
        const now = options.now ?? new Date().toISOString()

        for (const [target, match] of matchByTarget) {
          const entry = byId.get(target)!
          entry.chatTargetState = deriveChatTargetState(match)
          const thread = threadByMatch.get(match.id) ?? null
          // The chat_threads projection is the O(threads) canonical read; its
          // last-message presence is exactly the count-zero branch that
          // deriveRelationshipState needs (0 vs ≥1 messages).
          entry.relationshipState = deriveRelationshipState({
            matchStatus: match.status,
            messageCount: thread?.last_message_at ? 1 : 0,
            lastMessageSenderId: !thread?.last_message_sender_id
              ? null
              : thread.last_message_sender_id === viewerId
                ? 'viewer'
                : 'other',
            lastMessageAt: thread?.last_message_at ?? null,
            now,
          })
        }
      }
    }
  }

  return allowedIds.map((id) => byId.get(id)!)
}
