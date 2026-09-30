import { describe, expect, it } from 'vitest'
import {
  applyReactionToggle,
  buildReactionLabel,
  compareReactionSummaries,
  groupReactionsByMessage,
  isMessageReaction,
  MESSAGE_REACTIONS,
  QUICK_REACTIONS,
  summarizeReactions,
  type ReactionRecord,
  type ReactionSummary,
  type ReactionToggle,
} from '@/lib/chat/reactions'

function row(
  messageId: string,
  userId: string,
  emoji: string,
  createdAt = '2026-09-24T09:00:00.000Z',
): ReactionRecord {
  return { messageId, userId, emoji, createdAt }
}

describe('allowlist contract', () => {
  it('MESSAGE_REACTIONS is the single source of truth for valid emoji', () => {
    for (const emoji of MESSAGE_REACTIONS) {
      expect(isMessageReaction(emoji)).toBe(true)
    }
    expect(isMessageReaction('not-an-emoji')).toBe(false)
    expect(isMessageReaction(42)).toBe(false)
    expect(isMessageReaction(undefined)).toBe(false)
    expect(isMessageReaction('')).toBe(false)
  })

  it('QUICK_REACTIONS is the leading subset of MESSAGE_REACTIONS (picker dedup)', () => {
    expect(MESSAGE_REACTIONS.slice(0, QUICK_REACTIONS.length)).toEqual([
      ...QUICK_REACTIONS,
    ])
  })
})

describe('buildReactionLabel', () => {
  it('pluralizes by count', () => {
    expect(buildReactionLabel('🚀', 1, false)).toBe('🚀 1 reaction')
    expect(buildReactionLabel('🚀', 2, false)).toBe('🚀 2 reactions')
    expect(buildReactionLabel('🚀', 0, false)).toBe('🚀 0 reactions')
  })

  it('appends "including yours" only when the viewer reacted', () => {
    expect(buildReactionLabel('👍', 1, true)).toBe(
      '👍 1 reaction, including yours',
    )
    expect(buildReactionLabel('👍', 3, true)).toBe(
      '👍 3 reactions, including yours',
    )
  })
})

describe('compareReactionSummaries', () => {
  const summary = (emoji: ReactionSummary['emoji'], count: number): ReactionSummary => ({
    emoji,
    count,
    reactedByViewer: false,
    label: `${emoji} ${count} reactions`,
  })

  it('orders by count desc, ties by canonical emoji order', () => {
    const sorted = [summary('😂', 4), summary('💡', 2), summary('❤️', 2)].sort(
      compareReactionSummaries,
    )
    expect(sorted.map((s) => s.emoji)).toEqual(['😂', '❤️', '💡'])
  })
})

describe('summarizeReactions', () => {
  it('returns an empty array for no rows', () => {
    expect(summarizeReactions([], 'me')).toEqual([])
  })

  it('drops unknown emoji and de-duplicates replayed rows', () => {
    const rows = [
      row('m1', 'u1', '❤️'),
      row('m1', 'u1', '❤️'),
      row('m1', 'u1', 'legacy-emoji'),
    ]
    expect(summarizeReactions(rows, 'me')).toEqual([
      {
        emoji: '❤️',
        count: 1,
        reactedByViewer: false,
        label: '❤️ 1 reaction',
      },
    ])
  })

  it('de-duplicates on the (message, user, emoji) triple across users', () => {
    const rows = [
      row('m1', 'u1', '👍'),
      row('m1', 'u2', '👍'),
      row('m1', 'u2', '👍'),
    ]
    const [summary] = summarizeReactions(rows, 'me')
    expect(summary.count).toBe(2)
  })

  it('a single user with two emoji rows (defensive) yields two chips', () => {
    const rows = [
      row('m1', 'u1', '❤️'),
      row('m1', 'u1', '👍'),
    ]
    const summaries = summarizeReactions(rows, 'me')
    expect(summaries.map((s) => s.emoji)).toEqual(['❤️', '👍'])
    expect(summaries.map((s) => s.count)).toEqual([1, 1])
  })

  it('orders most-reacted first, ties in canonical emoji order', () => {
    const rows = [
      row('m1', 'u1', '❤️'),
      row('m1', 'u2', '❤️'),
      row('m1', 'a', '👍'),
      row('m1', 'b', '👍'),
      row('m1', 'c', '👍'),
      row('m1', 'x', '🚀'),
      row('m1', 'y', '🚀'),
    ]
    const summaries = summarizeReactions(rows, 'me')
    expect(summaries.map((s) => s.emoji)).toEqual(['👍', '❤️', '🚀'])
    expect(summaries.map((s) => s.count)).toEqual([3, 2, 2])
    expect(summaries.every((s) => !s.reactedByViewer)).toBe(true)
  })

  it('flags the viewer step and labels their chip', () => {
    const rows = [
      row('m1', 'me', '❤️'),
      row('m1', 'u2', '❤️'),
      row('m1', 'u3', '👍'),
    ]
    const summaries = summarizeReactions(rows, 'me')
    const heart = summaries.find((s) => s.emoji === '❤️')
    expect(heart).toEqual({
      emoji: '❤️',
      count: 2,
      reactedByViewer: true,
      label: '❤️ 2 reactions, including yours',
    })
  })

  it('sorting is stable across input order (no jitter)', () => {
    const rowsA = [row('m1', 'x', '🚀'), row('m1', 'u1', '❤️')]
    const rowsB = [row('m1', 'u1', '❤️'), row('m1', 'x', '🚀')]
    expect(summarizeReactions(rowsA, 'me').map((s) => s.emoji)).toEqual(
      summarizeReactions(rowsB, 'me').map((s) => s.emoji),
    )
  })
})

describe('groupReactionsByMessage', () => {
  it('returns an empty record for empty input', () => {
    expect(groupReactionsByMessage([], 'me')).toEqual({})
  })

  it('groups a batch into per-message summaries in one pass', () => {
    const rows = [
      row('m1', 'u1', '❤️'),
      row('m1', 'u2', '❤️'),
      row('m1', 'me', '👍'),
      row('m2', 'u9', '🎉'),
      row('m2', 'u9', '🎉'),
      row('m2', 'u9', 'bogus'),
      row('m3', 'u7', '🔥'),
    ]
    const grouped = groupReactionsByMessage(rows, 'me')

    expect(Object.keys(grouped).sort()).toEqual(['m1', 'm2', 'm3'])

    expect(grouped.m1.map((s) => [s.emoji, s.count, s.reactedByViewer])).toEqual(
      [
        ['❤️', 2, false],
        ['👍', 1, true],
      ],
    )
    expect(grouped.m2).toEqual([
      {
        emoji: '🎉',
        count: 1,
        reactedByViewer: false,
        label: '🎉 1 reaction',
      },
    ])
    expect(grouped.m3.map((s) => s.emoji)).toEqual(['🔥'])
  })
})

describe('applyReactionToggle', () => {
  const toggle = (
    messageId: string,
    userId: string,
    emoji: ReactionToggle['emoji'],
    active: boolean,
    createdAt?: string,
  ): ReactionToggle => ({ messageId, userId, emoji, active, createdAt })

  it('adds a new row when the user has no prior reaction', () => {
    const current = [row('m1', 'u2', '❤️')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '👍', true))
    expect(next.filter((r) => r.userId === 'me')).toHaveLength(1)
    expect(next.find((r) => r.userId === 'me')?.emoji).toBe('👍')
    expect(next.find((r) => r.userId === 'me')?.createdAt).toBeTruthy()
    expect(next.find((r) => r.userId === 'u2')).toEqual(row('m1', 'u2', '❤️'))
  })

  it('replaces the user previous emoji in-place (one row per user)', () => {
    const current = [row('m1', 'me', '❤️'), row('m1', 'u2', '❤️')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '🚀', true))
    expect(next.map((r) => r.userId)).toEqual(['u2', 'me'])
    expect(next.find((r) => r.userId === 'me')?.emoji).toBe('🚀')
  })

  it('removes the user row on active:false', () => {
    const current = [row('m1', 'me', '❤️'), row('m1', 'u2', '❤️')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '❤️', false))
    expect(next).toEqual([row('m1', 'u2', '❤️')])
  })

  it('targets only the (messageId, userId) pair', () => {
    const current = [
      row('m1', 'me', '❤️'),
      row('m2', 'me', '👍'),
      row('m1', 'other', '🎉'),
    ]
    const next = applyReactionToggle(current, toggle('m1', 'me', '❤️', false))
    expect(next).toEqual([
      row('m2', 'me', '👍'),
      row('m1', 'other', '🎉'),
    ])
  })

  it('re-echoing an already-applied add is an idempotent no-op (same reference)', () => {
    const current = [row('m1', 'me', '❤️', '2026-09-24T09:00:00.000Z')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '❤️', true))
    expect(next).toBe(current)
  })

  it('re-echoing a removal for an absent reaction is a no-op (same reference)', () => {
    const current = [row('m1', 'u2', '❤️')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '❤️', false))
    expect(next).toBe(current)
  })

  it('replaced rows keep the prior created_at so echoes do not churn it', () => {
    const current = [row('m1', 'me', '❤️', '2026-09-24T09:00:00.000Z')]
    const next = applyReactionToggle(current, toggle('m1', 'me', '🚀', true))
    expect(next.find((r) => r.userId === 'me')?.createdAt).toBe(
      '2026-09-24T09:00:00.000Z',
    )
  })

  it('new adds honour the envelope created_at before the client clock', () => {
    const current = [row('m1', 'u2', '❤️')]
    const stamped = applyReactionToggle(
      current,
      toggle('m1', 'me', '👍', true, '2026-09-24T10:00:00.000Z'),
    )
    expect(stamped.find((r) => r.userId === 'me')?.createdAt).toBe(
      '2026-09-24T10:00:00.000Z',
    )
  })

  it('new adds without a created_at mint an ISO timestamp as a fallback', () => {
    const current: ReactionRecord[] = []
    const next = applyReactionToggle(current, toggle('m1', 'me', '👍', true))
    const createdAt = next[0]?.createdAt
    expect(createdAt).toBeTruthy()
    expect(new Date(createdAt as string).toISOString()).toBe(createdAt)
  })
})