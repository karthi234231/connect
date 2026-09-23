// src/services/relationships/queue.ts
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// P0-11 â€” Matches as an ACTION QUEUE (spec Â§77, Â§140.2, Â§140.4, Â§192, Â§360.2).
//
// Â§77: "Matches are not another discovery feed. They are an action queue."
// Top sections: New Matches, Pending Actions, Active Conversations,
// Suggested Next Steps.
//
// This module is PURE â€” no I/O, no client, no clock. Every list and label is
// derived from authoritative fields already loaded by `getMatches`; nothing is
// invented, and nothing here can manufacture a relationship.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Â§140.2 canonical relationship status vocabulary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * The ten relationship statuses frozen by Â§140.2. Exported as a runtime tuple
 * so tests and future writers can iterate the contract rather than re-typing it.
 */
export const CANONICAL_RELATIONSHIP_STATES = [
  'suggested',
  'requested',
  'pending',
  'accepted',
  'active',
  'paused',
  'ended',
  'blocked',
  'restricted',
  'archived',
] as const

export type CanonicalRelationshipState =
  (typeof CANONICAL_RELATIONSHIP_STATES)[number]

/**
 * How far each canonical state is actually realised today. Recorded honestly so
 * no surface can claim a relationship lifecycle the product cannot produce
 * (Â§360.2 requires an explicit contract; it does not permit implied ones).
 *
 * - implemented â†’ the DB has a real column/row that produces this state
 * - derived     â†’ no stored column, but the state is computable from real data
 * - not_implemented â†’ no authoritative source exists yet; never render it
 */
export type RelationshipStateRealisation =
  'implemented' | 'derived' | 'not_implemented'

export interface RelationshipStateContractEntry {
  state: CanonicalRelationshipState
  realisation: RelationshipStateRealisation
  /** Authoritative source of truth, or null when none exists yet. */
  source: string | null
}

/** Â§360.2 frozen state-machine contract for the People Relationship entity. */
export const RELATIONSHIP_STATE_CONTRACT: readonly RelationshipStateContractEntry[] =
  [
    {
      state: 'suggested',
      realisation: 'implemented',
      source:
        'recommendations row (user_id, candidate_id) with a non-pass action',
    },
    {
      state: 'pending',
      realisation: 'implemented',
      source: "matches.status = 'pending'",
    },
    {
      state: 'active',
      realisation: 'implemented',
      source: "matches.status = 'active'",
    },
    {
      state: 'ended',
      realisation: 'implemented',
      source: "matches.status = 'declined'",
    },
    {
      state: 'blocked',
      realisation: 'implemented',
      source: 'blocks row for either participant',
    },
    {
      state: 'restricted',
      realisation: 'implemented',
      source: 'match_relationship_settings (mute / restricted messaging)',
    },
    {
      state: 'requested',
      realisation: 'derived',
      source:
        "matches.status = 'pending' AND the viewer is the participant who swiped right",
    },
    {
      state: 'accepted',
      realisation: 'derived',
      source: "matches.status = 'active' with zero messages in the thread",
    },
    {
      state: 'paused',
      realisation: 'not_implemented',
      source: null,
    },
    {
      state: 'archived',
      realisation: 'not_implemented',
      source: null,
    },
  ]

// â”€â”€â”€ Â§192 explanation standard: qualitative bands, never a raw score â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Â§77: "Never expose a raw algorithmic score such as `87.42% compatible`
 * without a meaningful interpretation." Â§192: "Never expose raw ML scores
 * unless there is a specific product reason."
 *
 * So the numeric score stays internal (used for ordering and diagnosis) and the
 * UI receives a band label instead. Thresholds live here, once.
 */
export const FIT_BAND_THRESHOLDS = {
  /** Inclusive lower bound for "strong". */
  strong: 80,
  /** Inclusive lower bound for "good". */
  good: 65,
  /** Inclusive lower bound for "promising". */
  promising: 50,
} as const

export type FitBand = 'strong' | 'good' | 'promising' | 'unknown'

/** User-facing label per band. `unknown` has none and must be omitted. */
export const FIT_BAND_LABELS: Record<Exclude<FitBand, 'unknown'>, string> = {
  strong: 'Strong fit',
  good: 'Good fit',
  promising: 'Worth exploring',
}

/** Classify a real 0-100 score into a display band. Null/NaN â†’ unknown. */
export function fitBand(score: number | null | undefined): FitBand {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'unknown'
  if (score >= FIT_BAND_THRESHOLDS.strong) return 'strong'
  if (score >= FIT_BAND_THRESHOLDS.good) return 'good'
  if (score >= FIT_BAND_THRESHOLDS.promising) return 'promising'
  return 'unknown'
}

/** Band label, or null when no real score exists (caller omits the element). */
export function fitBandLabel(score: number | null | undefined): string | null {
  const band = fitBand(score)
  return band === 'unknown' ? null : FIT_BAND_LABELS[band]
}
// â”€â”€â”€ Â§77 action queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface QueueMatch {
  matchId: string
  otherUser: {
    id: string
    fullName: string
    role: string
    avatarUrl?: string | null
  }
  status: 'pending' | 'active' | 'declined'
  createdAt: string
  /** Real `matches.score`, or null. Ordering only â€” never displayed raw. */
  score: number | null
  /** Latest thread activity (last message, else the match timestamp). */
  lastActivityAt: string
  /**
   * True when the viewer's own stored recommendation shows they swiped right.
   * A match only exists because someone swiped right, so a viewer 'like' row
   * for that candidate means the viewer is the initiator.
   */
  initiatedByViewer: boolean
  lastMessage?: {
    content: string
    createdAt: string
    senderId: string
  }
  unreadCount: number
  matchReason?: string
}

export const MATCH_QUEUE_SECTIONS = [
  'new_matches',
  'pending_actions',
  'active_conversations',
  'next_steps',
] as const

export type MatchQueueSectionId = (typeof MATCH_QUEUE_SECTIONS)[number]

export interface NextStep {
  matchId: string
  /** Other participant's first name â€” real profile data only. */
  name: string
  /** One imperative, non-marketing instruction (Â§114). */
  action: string
  href: string
}

export interface MatchQueue {
  newMatches: QueueMatch[]
  pendingActions: QueueMatch[]
  activeConversations: QueueMatch[]
  nextSteps: NextStep[]
  counts: Record<MatchQueueSectionId, number>
}

interface QueueInput {
  /** Reference "now" (ISO). Injectable so nudges are deterministic in tests. */
  now: string
  /** Hours since the viewer's own unanswered message before prompting a follow-up. */
  followUpHours?: number
  /** Hours of silence (other side spoke last) before prompting a reply. */
  quietHours?: number
}

const DEFAULT_FOLLOW_UP_HOURS = 24
const DEFAULT_QUIET_HOURS = 72
const MAX_NEXT_STEPS = 4

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/** Ordering inside a section: best real fit first, then most recent. */
function byFitThenRecency(a: QueueMatch, b: QueueMatch): number {
  const sa = a.score ?? -1
  const sb = b.score ?? -1
  if (sa !== sb) return sb - sa
  return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
}

function hoursSince(iso: string, now: string): number | null {
  const t = Date.parse(iso)
  const n = Date.parse(now)
  if (!Number.isFinite(t) || !Number.isFinite(n)) return null
  return (n - t) / 3_600_000
}

/**
 * §77 grouping. Declined matches are terminal and never enter the queue.
 *
 * One primary section per match — no duplication between the three lists:
 * - New Matches          → active, no message yet (conversation not started)
 * - Pending Actions      → pending (a decision is owed by someone)
 * - Active Conversations → active with at least one message in the thread
 *
 * `nextSteps` is the §77 "Suggested Next Steps" strip: at most one nudge per
 * match, each derived from a real timestamp or a real unread count.
 */
export function buildMatchQueue(
  matches: readonly QueueMatch[],
  input: QueueInput,
): MatchQueue {
  const now = input.now
  const followUpHours = input.followUpHours ?? DEFAULT_FOLLOW_UP_HOURS
  const quietHours = input.quietHours ?? DEFAULT_QUIET_HOURS

  const actionable = matches.filter((m) => m.status !== 'declined')

  const newMatches: QueueMatch[] = []
  const pendingActions: QueueMatch[] = []
  const activeConversations: QueueMatch[] = []
  const nextSteps: NextStep[] = []

  for (const match of actionable) {
    const hasMessage = Boolean(match.lastMessage)

    if (match.status === 'pending') {
      pendingActions.push(match)
      continue
    }

    if (hasMessage) {
      activeConversations.push(match)
    } else {
      newMatches.push(match)
    }

    // §77 Suggested Next Steps — one real nudge per match.
    const name = firstNameOf(match.otherUser.fullName)
    const href = `/dashboard/chat/${match.matchId}`

    if (!hasMessage) {
      nextSteps.push({
        matchId: match.matchId,
        name,
        action: `Send the first message to ${name}`,
        href,
      })
      continue
    }

    if (match.unreadCount > 0) {
      nextSteps.push({
        matchId: match.matchId,
        name,
        action:
          match.unreadCount === 1
            ? `${name} replied — 1 unread message`
            : `${name} replied — ${match.unreadCount} unread messages`,
        href,
      })
      continue
    }

    const last = match.lastMessage
    if (!last) continue
    const hours = hoursSince(last.createdAt, now)
    if (hours === null) continue

    if (last.senderId !== match.otherUser.id) {
      // Viewer spoke last: only prompt once the silence is real.
      if (hours >= followUpHours) {
        nextSteps.push({
          matchId: match.matchId,
          name,
          action: `Follow up with ${name} — your last message is ${Math.floor(hours)}h old`,
          href,
        })
      }
      continue
    }

    // Other side spoke last and the viewer already read it.
    if (hours >= quietHours) {
      nextSteps.push({
        matchId: match.matchId,
        name,
        action: `Reply to ${name} — this thread has been quiet for ${Math.floor(hours)}h`,
        href,
      })
    }
  }

  newMatches.sort(byFitThenRecency)
  pendingActions.sort(byFitThenRecency)
  activeConversations.sort(byFitThenRecency)

  const orderedNextSteps = nextSteps.slice(0, MAX_NEXT_STEPS)

  return {
    newMatches,
    pendingActions,
    activeConversations,
    nextSteps: orderedNextSteps,
    counts: {
      new_matches: newMatches.length,
      pending_actions: pendingActions.length,
      active_conversations: activeConversations.length,
      next_steps: orderedNextSteps.length,
    },
  }
}
