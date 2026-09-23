// src/services/relationships/mutual-context.ts
// ─────────────────────────────────────────────────────────────────────────────
// V10-BE-07 — single server authority for explainable shared context.
//
// `getMutualContext(viewerId, targetUserId)` returns a typed, BOUNDED list of
// explainable context items that are built ONLY from real stored product data.
// It never returns raw private rows; each item carries {source, explanation,
// safeTokens} so rendering, auditing and removal never touch unrelated profile
// data.
//
// Allowed sources (V10-BE-07 / V10-BE-02), mapped to real stored data:
//   shared_interest      → idea_interests rows (action like/spark) on the same
//                          published idea for both users
//   shared_skill         → profiles.skills intersection
//   complementary_skill  → viewer's role in target.looking_for.roles (mirrors
//                          the matching engine's `looking_for:{role}` evidence)
//   shared_event         → event_attendees status = 'going' on the same event
//   shared_idea          → team_memberships on the same idea
//   same_city            → NOT AVAILABLE: profiles have no location/city column
//                          today (verified against the schema). Locally gated
//                          by LOCATION_CONTEXT_AVAILABLE = false; the source
//                          never emits, so it degrades safely.
//
// Permission gating happens BEFORE any context assembly:
//   * viewer === target            → []
//   * either direction blocked      → [] (areBlocked is fail-closed: it throws
//                                     on infrastructure failure)
//   * target profile not public/recruiting AND no active match → [] (privacy)
//
// Reads use the service-role client because the ideas/event RLS policies hide
// the TARGET's rows from the viewer; the service compensates with the privacy
// gates above and only ever returns bounded safe tokens.
//
// Query budget is bounded and there is NO N+1 loop for profile cards: exactly
// two profile rows are fetched once, then three batch joins, then three
// bounded title lookups.
// ─────────────────────────────────────────────────────────────────────────────

import { getAdminSupabaseClient } from '@/lib/supabase/admin'
import { areBlocked } from '@/services/safety/safety.service'
import { AppError, ErrorCodes } from '@/lib/errors'
import { logger } from '@/lib/logger'

export const MUTUAL_CONTEXT_LIMIT = 6

/** Narrow row shapes for the batched cross-domain reads (schema predates the
 *  generated Database types; validated at runtime by DB constraints). */
export interface AttendeeRow {
  event_id: string
  user_id: string
}

export interface MemberRow {
  idea_id: string
  user_id: string
}

export interface InterestRow {
  idea_id: string
  user_id: string
}

export const MUTUAL_CONTEXT_SOURCES = [
  'shared_interest',
  'shared_skill',
  'complementary_skill',
  'shared_event',
  'shared_idea',
  'same_city',
] as const

export type MutualContextSource = (typeof MUTUAL_CONTEXT_SOURCES)[number]

export interface MutualContextItem {
  source: MutualContextSource
  /** Deterministic, human-readable explanation derived ONLY from stored data. */
  explanation: string
  /** Opaque audit/dedupe tokens — never raw private rows. */
  safeTokens: string[]
}

/** Interest signals that count as "showed interest" in an idea. */
export const INTEREST_ACTIONS = ['like', 'spark'] as const

/**
 * Location-based context is not available: the profiles schema has no
 * city/location column (only `timezone`, which is not city data). Keep the
 * source in the allowed list but gate collection off so we never fabricate a
 * city. Set to `true` only once a stored, permission-gated location exists.
 */
export const LOCATION_CONTEXT_AVAILABLE = false

// ─── Pure assembly (unit-tested, no I/O) ────────────────────────────────────

export interface MutualContextProfileInput {
  role: string | null
  skills: string[]
  lookingForRoles: string[]
  visibility: string
}

export interface MutualContextSourceData {
  viewer: Pick<MutualContextProfileInput, 'role' | 'skills'>
  target: Pick<MutualContextProfileInput, 'role' | 'skills' | 'visibility'> & {
    lookingForRoles: string[]
    fullName: string | null
  }
  sharedEvents: Array<{ title: string }>
  sharedIdeas: Array<{ title: string }>
  sharedInterestIdeas: Array<{ title: string }>
  /** Only honored when LOCATION_CONTEXT_AVAILABLE is true. */
  sameCity?: { city: string } | null
  limit?: number
}

function cap(items: MutualContextItem[], limit: number): MutualContextItem[] {
  return items.slice(0, limit)
}

/**
 * Deterministic assembly from already-fetched real data. Items are emitted in
 * fixed source priority; within a source they are sorted by token so output is
 * stable. Total output is bounded by `limit` (default 6).
 */
export function assembleMutualContext(
  data: MutualContextSourceData,
): MutualContextItem[] {
  const limit = data.limit ?? MUTUAL_CONTEXT_LIMIT
  const items: MutualContextItem[] = []

  const sharedSkills = (data.viewer.skills ?? []).filter((skill) =>
    (data.target.skills ?? []).includes(skill),
  )
  for (const skill of sharedSkills.sort()) {
    items.push({
      source: 'shared_skill',
      explanation: `You both know ${skill}.`,
      safeTokens: ['shared_skill', skill],
    })
  }

  const interestTitles = (data.sharedInterestIdeas ?? []).map((e) => e.title)
  for (const title of [...new Set(interestTitles)].sort()) {
    items.push({
      source: 'shared_interest',
      explanation: `You both showed interest in "${title}".`,
      safeTokens: ['shared_interest', title],
    })
  }

  const eventTitles = (data.sharedEvents ?? []).map((e) => e.title)
  for (const title of [...new Set(eventTitles)].sort()) {
    items.push({
      source: 'shared_event',
      explanation: `You're both going to ${title}.`,
      safeTokens: ['shared_event', title],
    })
  }

  const ideaTitles = (data.sharedIdeas ?? []).map((e) => e.title)
  for (const title of [...new Set(ideaTitles)].sort()) {
    items.push({
      source: 'shared_idea',
      explanation: `You're both on the team for "${title}".`,
      safeTokens: ['shared_idea', title],
    })
  }

  // Complementary: the viewer's role appears in what the target is looking
  // for. Mirrors the matching engine's `looking_for:{role}` evidence format.
  if (data.viewer.role) {
    const lookingFor = data.target.lookingForRoles ?? []
    if (lookingFor.includes(data.viewer.role)) {
      items.push({
        source: 'complementary_skill',
        explanation: `They're looking for a ${data.viewer.role} — that's you.`,
        safeTokens: ['complementary_skill', data.viewer.role],
      })
    }
  }

  if (LOCATION_CONTEXT_AVAILABLE && data.sameCity?.city) {
    items.push({
      source: 'same_city',
      explanation: `You're both in ${data.sameCity.city}.`,
      safeTokens: ['same_city', data.sameCity.city],
    })
  }

  return cap(items, limit)
}

// ─── Service (authoritative, permission-gated) ──────────────────────────────

const DISCOVERABLE_VISIBILITIES = ['public', 'recruiting']

interface ProfileContextRow {
  id: string
  full_name: string | null
  role: string | null
  skills: string[]
  looking_for: { roles: string[] } | null
  visibility: 'public' | 'recruiting' | 'private' | 'stealth' | string
}

/**
 * Typed list of explainable shared-context items for (viewer, target).
 *
 * Permissions are checked BEFORE assembly. On blocked pairs or a missing /
 * not-discoverable target (with no active match) the service returns a safe
 * empty list — never a partial result or raw private rows. Infrastructure
 * failures fail CLOSED (throw) so callers never see context they could not
 * verify.
 */
export async function getMutualContext(
  viewerId: string,
  targetUserId: string,
): Promise<MutualContextItem[]> {
  if (viewerId === targetUserId) {
    return []
  }

  // Fail-closed permission gate: areBlocked throws on infrastructure failure
  // (getCachedBlocks), so a redis/DB outage never yields context.
  if (await areBlocked(viewerId, targetUserId)) {
    return []
  }

  const admin = getAdminSupabaseClient()

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, full_name, role, skills, looking_for, visibility')
    .in('id', [viewerId, targetUserId])

  if (profilesError) {
    logger.error('Mutual context: profile read failed', {
      viewerId,
      targetUserId,
      error: profilesError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
      cause: profilesError,
    })
  }

  const rows = (profiles ?? []) as ProfileContextRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))
  const viewer = byId.get(viewerId)
  const target = byId.get(targetUserId)

  if (!viewer || !target) {
    // One side not found / not usable → safe empty state, no probing.
    return []
  }

  // Privacy gate: only build deeper context from a discoverable target, or
  // from a target already in an ACTIVE match with the viewer (consented pair).
  const discoverable = DISCOVERABLE_VISIBILITIES.includes(target.visibility)
  if (!discoverable) {
    const { data: activeMatch, error: activeError } = await admin
      .from('matches')
      .select('id')
      .eq('status', 'active')
      .or(`user1_id.eq.${viewerId},user2_id.eq.${viewerId}`)
      .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
      .limit(1)

    if (activeError) {
      logger.error('Mutual context: active-match gate failed', {
        viewerId,
        targetUserId,
        error: activeError.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
        cause: activeError,
      })
    }

    if (!activeMatch || activeMatch.length === 0) {
      return []
    }
  }

  const bothIds = [viewerId, targetUserId]
  const limit = MUTUAL_CONTEXT_LIMIT

  // Shared events (batch, bounded).
  const { data: attendeeRows, error: attendeeError } = await admin
    .from('event_attendees')
    .select('event_id, user_id')
    .in('user_id', bothIds)
    .eq('status', 'going')
    .limit(limit * 2)

  if (attendeeError) {
    logger.error('Mutual context: event read failed', {
      error: attendeeError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
      cause: attendeeError,
    })
  }

  const viewerEvents = new Set(
    (attendeeRows ?? [])
      .filter((r: AttendeeRow) => r.user_id === viewerId)
      .map((r: AttendeeRow) => r.event_id),
  )
  const sharedEventIds = (attendeeRows ?? [])
    .filter(
      (r: AttendeeRow) =>
        viewerEvents.has(r.event_id) && r.user_id !== viewerId,
    )
    .map((r: AttendeeRow) => r.event_id)

  let sharedEvents: Array<{ title: string }> = []
  if (sharedEventIds.length > 0) {
    const { data: eventRows, error: eventError } = await admin
      .from('events')
      .select('id, title')
      .in('id', sharedEventIds)
      .limit(limit)

    if (eventError) {
      logger.error('Mutual context: event title read failed', {
        error: eventError.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
        cause: eventError,
      })
    }

    sharedEvents =
      (eventRows ?? []).map((row: { title: string }) => ({
        title: row.title,
      })) ?? []
  }

  // Shared ideas (team memberships) + shared interests (idea_interests).
  const { data: memberRows, error: memberError } = await admin
    .from('team_memberships')
    .select('idea_id, user_id')
    .in('user_id', bothIds)
    .limit(limit * 2)

  if (memberError) {
    logger.error('Mutual context: team membership read failed', {
      error: memberError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
      cause: memberError,
    })
  }

  const viewerIdeas = new Set(
    (memberRows ?? [])
      .filter((r: MemberRow) => r.user_id === viewerId)
      .map((r: MemberRow) => r.idea_id),
  )
  const sharedIdeaIds = (memberRows ?? [])
    .filter(
      (r: MemberRow) => viewerIdeas.has(r.idea_id) && r.user_id !== viewerId,
    )
    .map((r: MemberRow) => r.idea_id)

  const { data: interestRows, error: interestError } = await admin
    .from('idea_interests')
    .select('idea_id, user_id')
    .in('user_id', bothIds)
    .in('action', INTEREST_ACTIONS)
    .limit(limit * 2)

  if (interestError) {
    logger.error('Mutual context: interest read failed', {
      error: interestError.message,
    })
    throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
      cause: interestError,
    })
  }

  const viewerInterestIds = new Set(
    (interestRows ?? [])
      .filter((r: InterestRow) => r.user_id === viewerId)
      .map((r: InterestRow) => r.idea_id),
  )
  const sharedInterestIds = (interestRows ?? [])
    .filter(
      (r: InterestRow) =>
        viewerInterestIds.has(r.idea_id) && r.user_id !== viewerId,
    )
    .map((r: InterestRow) => r.idea_id)

  const sharedIdeas: Array<{ title: string }> = []
  const sharedInterestIdeas: Array<{ title: string }> = []

  const ideaIds = [...new Set([...sharedIdeaIds, ...sharedInterestIds])]
  if (ideaIds.length > 0) {
    const { data: ideaRows, error: ideaError } = await admin
      .from('ideas')
      .select('id, title')
      .in('id', ideaIds)
      .eq('visibility', 'published')
      .limit(limit * 2)

    if (ideaError) {
      logger.error('Mutual context: idea title read failed', {
        error: ideaError.message,
      })
      throw new AppError(ErrorCodes.INTERNAL, 'Failed to load mutual context', {
        cause: ideaError,
      })
    }

    const titlesById = new Map(
      ((ideaRows ?? []) as Array<{ id: string; title: string }>).map((row) => [
        row.id,
        row.title,
      ]),
    )

    sharedIdeaIds.forEach((id: string) => {
      const title = titlesById.get(id)
      if (title) sharedIdeas.push({ title })
    })
    sharedInterestIds.forEach((id: string) => {
      const title = titlesById.get(id)
      if (title) sharedInterestIdeas.push({ title })
    })
  }

  return assembleMutualContext({
    viewer: { role: viewer.role, skills: viewer.skills ?? [] },
    target: {
      role: target.role,
      skills: target.skills ?? [],
      lookingForRoles: target.looking_for?.roles ?? [],
      visibility: target.visibility,
      fullName: target.full_name,
    },
    sharedEvents,
    sharedIdeas,
    sharedInterestIdeas,
    sameCity: null,
    limit,
  })
}
