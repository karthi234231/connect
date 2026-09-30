// src/lib/chat/reactions.ts
// P0-12 — Message reactions contract.
// Spec §13 (message model), §144.2 (conversation actions), §272.2 (message
// requirements), §210 (concurrency), §343 (event contract), §366.3 (AC-MSG).
//
// Client-safe (no server-only imports). Single source of truth for the
// allowlisted emoji set, the aggregated chip model and the optimistic mirror,
// shared by the service, the realtime protocol, the server action and the UI so
// they can never drift.

export const QUICK_REACTIONS = ['❤️', '👍', '🚀', '💡'] as const
export type QuickReaction = (typeof QUICK_REACTIONS)[number]

/**
 * Allowlisted reaction emoji. A fixed set means no arbitrary string can ever
 * reach storage (RULE 024 / §381 input validation) and keeps the chip row
 * bounded regardless of client behaviour.
 */
export const MESSAGE_REACTIONS = [
  '❤️',
  '👍',
  '🚀',
  '💡',
  '😂',
  '🎉',
  '🙌',
  '👀',
  '🔥',
  '🤝',
] as const

export type MessageReaction = (typeof MESSAGE_REACTIONS)[number]

export function isMessageReaction(value: unknown): value is MessageReaction {
  return (
    typeof value === 'string' &&
    (MESSAGE_REACTIONS as readonly string[]).includes(value)
  )
}

/** One persisted reaction row, projected for the UI (snake_case never leaks). */
export interface ReactionRecord {
  messageId: string
  userId: string
  /** Loose string: unknown values are filtered, never trusted (§381). */
  emoji: string
  createdAt: string
}

/** Aggregated chip rendered under a message bubble. */
export interface ReactionSummary {
  emoji: MessageReaction
  count: number
  /** Viewer reacted with this emoji — drives the pressed/active style. */
  reactedByViewer: boolean
  /** Stable accessible label (never colour-only signalling). */
  label: string
}

/** Most-reacted first, then canonical emoji order so ordering never jitters. */
export function compareReactionSummaries(
  a: ReactionSummary,
  b: ReactionSummary,
): number {
  if (a.count !== b.count) return b.count - a.count
  return MESSAGE_REACTIONS.indexOf(a.emoji) - MESSAGE_REACTIONS.indexOf(b.emoji)
}

export function buildReactionLabel(
  emoji: string,
  count: number,
  reactedByViewer: boolean,
): string {
  const noun = count === 1 ? 'reaction' : 'reactions'
  return reactedByViewer
    ? `${emoji} ${count} ${noun}, including yours`
    : `${emoji} ${count} ${noun}`
}

/**
 * Group raw rows into chips for a single message. Pure — no I/O, no clock.
 *
 * `(message_id, user_id, emoji)` is unique in storage, so duplicates can only
 * arrive via a replayed realtime event; they are de-duplicated defensively so a
 * replay never double-counts (AC-MSG-004 / §343 idempotency).
 */
export function summarizeReactions(
  rows: readonly ReactionRecord[],
  viewerId: string,
): ReactionSummary[] {
  const seen = new Set<string>()
  const counts = new Map<MessageReaction, number>()
  const mine = new Set<MessageReaction>()

  for (const row of rows) {
    if (!isMessageReaction(row.emoji)) continue // unknown/legacy values dropped
    const key = `${row.messageId}:${row.userId}:${row.emoji}`
    if (seen.has(key)) continue
    seen.add(key)

    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1)
    if (row.userId === viewerId) mine.add(row.emoji)
  }

  return [...counts.entries()]
    .map(([emoji, count]) => {
      const reactedByViewer = mine.has(emoji)
      return {
        emoji,
        count,
        reactedByViewer,
        label: buildReactionLabel(emoji, count, reactedByViewer),
      }
    })
    .sort(compareReactionSummaries)
}

/** Group a batch of rows per message in one pass — never one query per message. */
export function groupReactionsByMessage(
  rows: readonly ReactionRecord[],
  viewerId: string,
): Record<string, ReactionSummary[]> {
  const buckets = new Map<string, ReactionRecord[]>()

  for (const row of rows) {
    const bucket = buckets.get(row.messageId)
    if (bucket) bucket.push(row)
    else buckets.set(row.messageId, [row])
  }

  const grouped: Record<string, ReactionSummary[]> = {}

  for (const [messageId, bucket] of buckets) {
    grouped[messageId] = summarizeReactions(bucket, viewerId)
  }

  return grouped
}

export interface ReactionToggle {
  messageId: string
  userId: string
  emoji: MessageReaction
  /** true = add, false = remove. */
  active: boolean
  createdAt?: string
}

/**
 * Mirror one confirmed toggle into the local projection so the UI never needs a
 * refetch. §210: the server stays authoritative — callers apply this only after
 * the server confirms, and revert the previous value when it rejects.
 *
 * Storage keeps one reaction per (message, user) — the server replaces the old
 * emoji on every confirmed toggle — so `active: true` removes ALL of that
 * user's rows for the message before adding, keeping the mirror convergent
 * with what `getReactions` will next return.
 */
export function applyReactionToggle(
  current: readonly ReactionRecord[],
  toggle: ReactionToggle,
): ReactionRecord[] {
  const matches = (row: ReactionRecord): boolean =>
    row.messageId === toggle.messageId && row.userId === toggle.userId

  const existing = current.find(matches)

  // Idempotency (§343 / AC-MSG-004): a replayed or own-echo'd envelope already
  // reflected in the state is a no-op that returns the SAME reference, so a
  // reducer (React StrictMode re-invokes updaters) bails out of the re-render
  // instead of churning a fresh array on every echo.
  if (toggle.active && existing?.emoji === toggle.emoji) {
    return current as ReactionRecord[]
  }
  if (!toggle.active && existing === undefined) {
    return current as ReactionRecord[]
  }

  // Replace semantics: the user's previous emoji (if any) always goes.
  const without = current.filter((row) => !matches(row))

  if (!toggle.active) return without

  return [
    ...without,
    {
      messageId: toggle.messageId,
      userId: toggle.userId,
      emoji: toggle.emoji,
      // Keep a replaced row's timestamp so repeated echoes never churn the
      // row's place in the projection; fall back to the envelope's time, then
      // the client clock, for a genuinely new reaction.
      createdAt:
        toggle.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    },
  ]
}
