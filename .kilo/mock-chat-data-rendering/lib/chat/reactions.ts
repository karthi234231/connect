export const MESSAGE_REACTIONS = [
  '\u{1F44D}', // 👍
  '\u2764\uFE0F', // ❤️
  '\u{1F602}', // 😂
  '\u{1F62E}', // 😮
  '\u{1F622}', // 😢
  '\u{1F64F}', // 🙏
  '\u{1F389}', // 🎉
  '\u{1F525}', // 🔥
] as const

export const QUICK_REACTIONS = [
  '\u{1F44D}', // 👍
  '\u2764\uFE0F', // ❤️
  '\u{1F602}', // 😂
] as const

export type MessageReaction = (typeof MESSAGE_REACTIONS)[number]

export interface ReactionSummary {
  emoji: MessageReaction
  count: number
  label: string
  reactedByViewer: boolean
}

export interface ReactionRecord {
  messageId: string
  userId: string
  emoji: MessageReaction
}

function reactionLabel(emoji: MessageReaction, count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'} reacted with ${emoji}`
}

/**
 * Collapse the flat reaction records into per-message summaries, ordered by
 * the canonical emoji order, marking which the viewer selected.
 */
export function groupReactionsByMessage(
  records: ReactionRecord[],
  viewerId: string,
): Record<string, ReactionSummary[]> {
  const byMessage: Record<string, Map<MessageReaction, ReactionSummary>> = {}

  for (const record of records) {
    const perMessage = (byMessage[record.messageId] ??= new Map())
    const existing = perMessage.get(record.emoji)
    if (existing) {
      existing.count += 1
      existing.reactedByViewer =
        existing.reactedByViewer || record.userId === viewerId
      existing.label = reactionLabel(record.emoji, existing.count)
    } else {
      perMessage.set(record.emoji, {
        emoji: record.emoji,
        count: 1,
        reactedByViewer: record.userId === viewerId,
        label: reactionLabel(record.emoji, 1),
      })
    }
  }

  const result: Record<string, ReactionSummary[]> = {}
  for (const [messageId, perMessage] of Object.entries(byMessage)) {
    result[messageId] = MESSAGE_REACTIONS.map((emoji) =>
      perMessage.get(emoji),
    ).filter((summary): summary is ReactionSummary => summary !== undefined)
  }
  return result
}

/**
 * Add or remove a single viewer reaction record, returning a new array.
 */
export function applyReactionToggle(
  records: ReactionRecord[],
  toggle: {
    messageId: string
    userId: string
    emoji: MessageReaction
    active: boolean
  },
): ReactionRecord[] {
  const without = records.filter(
    (record) =>
      !(
        record.messageId === toggle.messageId &&
        record.userId === toggle.userId &&
        record.emoji === toggle.emoji
      ),
  )
  if (!toggle.active) return without
  return [
    ...without,
    {
      messageId: toggle.messageId,
      userId: toggle.userId,
      emoji: toggle.emoji,
    },
  ]
}
