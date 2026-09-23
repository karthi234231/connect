// src/lib/relationships/history.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-safe single source of truth for relationship-history transitions
// (spec §140.4). Pure — no I/O, no Supabase import — so both the server read
// model (`@/services/relationships/history`) and client components share ONE
// vocabulary and ONE label map. That prevents the classic drift where the DB
// stores `match_accepted` and the UI invents "You connected".
//
// Fail-safe by design: an unreadable or unknown persisted value is dropped,
// never guessed with a fallback label.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every persisted transition value (public.match_timeline_event_type). Kept as
 * a runtime tuple so the parser and the UI label map cannot drift.
 */
export const RELATIONSHIP_HISTORY_EVENTS = [
  'match_created',
  'match_accepted',
  'first_reply',
  'intro_requested',
  'call_scheduled',
  'group_joined',
  'contribution',
  'relationship_ended',
] as const

export type RelationshipHistoryEvent =
  (typeof RELATIONSHIP_HISTORY_EVENTS)[number]

export interface RelationshipHistoryEntry {
  id: string
  event: RelationshipHistoryEvent
  at: string
}

const EVENT_LABELS: Record<RelationshipHistoryEvent, string> = {
  match_created: 'You matched',
  match_accepted: 'Intro accepted',
  first_reply: 'First reply',
  intro_requested: 'Intro requested',
  call_scheduled: 'Call scheduled',
  group_joined: 'Joined a group together',
  contribution: 'Shared a contribution',
  relationship_ended: 'Relationship ended',
}

const EVENT_SET = new Set<string>(RELATIONSHIP_HISTORY_EVENTS)

/** Human label for one real event. Null for an unknown persisted value. */
export function relationshipHistoryLabel(event: string): string | null {
  return EVENT_SET.has(event)
    ? EVENT_LABELS[event as RelationshipHistoryEvent]
    : null
}

/** Narrow an unknown DB value to a known transition. */
export function isRelationshipHistoryEvent(
  value: unknown,
): value is RelationshipHistoryEvent {
  return typeof value === 'string' && EVENT_SET.has(value)
}

/**
 * Coerce raw rows into the ordered contract. Unknown event types and rows with
 * an unparseable timestamp are dropped rather than rendered with a guessed
 * label, and the result is sorted oldest → newest (the reading order of a
 * timeline) using the DB timestamp, not array position.
 */
export function parseRelationshipHistory(
  rows: readonly { id?: unknown; event_type?: unknown; created_at?: unknown }[],
): RelationshipHistoryEntry[] {
  const entries: RelationshipHistoryEntry[] = []

  for (const row of rows) {
    if (typeof row.id !== 'string') continue
    if (!isRelationshipHistoryEvent(row.event_type)) continue
    if (typeof row.created_at !== 'string') continue
    if (!Number.isFinite(Date.parse(row.created_at))) continue

    entries.push({
      id: row.id,
      event: row.event_type,
      at: row.created_at,
    })
  }

  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  return entries
}
