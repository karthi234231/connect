import { avatarTone, getInitials } from './avatar'

export type InboxFilter = 'all' | 'unread' | 'new'

export interface InboxThread {
  /** The conversation key — the match id (uuid). */
  id: string
  peerUserId: string
  name: string
  initials: string
  tone: string
  avatarUrl: string | null
  matchReason: string | null
  /** Display text; '' when there are no messages yet. */
  lastMessage: string
  /** ISO timestamp, or null when there are no messages. */
  lastMessageAt: string | null
  /** Author of the last message (profile id); null when there are none. */
  lastMessageSenderId: string | null
  /** Short display time; '' when there are no messages. */
  timeLabel: string
  unreadCount: number
  hasMessages: boolean
  status: 'active' | 'pending'
}

export interface InboxConversationInput {
  matchId: string
  otherUserId: string
  lastMessageAt: string | null
  lastMessageContent: string | null
  lastMessageSenderId: string | null
  unread: number
}

export interface InboxPeerInput {
  matchId: string
  userId: string
  fullName: string
  avatarUrl?: string | null
  role?: string | null
  status?: string
  /** Human-readable match reason label (e.g. "Common interest: design"). */
  matchReason?: string | null
}

const FALLBACK_NAME = 'New match'

const MS_DAY = 24 * 60 * 60 * 1000
const MS_WEEK = 7 * MS_DAY

const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

function isSameCalendarDay(leftMs: number, rightMs: number): boolean {
  const left = new Date(leftMs)
  const right = new Date(rightMs)
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function formatInboxTimeLabel(iso: string, now: Date): string {
  const thenMs = new Date(iso).getTime()
  if (Number.isNaN(thenMs)) return ''
  const nowMs = now.getTime()

  if (isSameCalendarDay(thenMs, nowMs)) {
    return timeFormatter.format(new Date(thenMs))
  }

  const diff = nowMs - thenMs
  if (diff > 0 && diff < MS_WEEK) {
    return weekdayFormatter.format(new Date(thenMs))
  }

  return monthDayFormatter.format(new Date(thenMs))
}

/** Short display time for a message timestamp; '' for null/empty input. */
export function formatInboxTime(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (!iso) return ''
  return formatInboxTimeLabel(iso, now)
}

function compareByLastMessageAt(a: InboxThread, b: InboxThread): number {
  if (a.lastMessageAt == null && b.lastMessageAt == null) return 0
  if (a.lastMessageAt == null) return 1
  if (b.lastMessageAt == null) return -1
  return b.lastMessageAt.localeCompare(a.lastMessageAt)
}

function buildInboxThread(
  conversation: InboxConversationInput,
  peer: InboxPeerInput | undefined,
  now: Date,
): InboxThread {
  const seedName = peer?.fullName.trim() || conversation.otherUserId || ''
  const name = peer?.fullName.trim() || FALLBACK_NAME
  const hasMessages = conversation.lastMessageAt != null

  return {
    id: conversation.matchId,
    peerUserId: peer?.userId ?? conversation.otherUserId,
    name,
    initials: getInitials(seedName),
    tone: avatarTone(seedName),
    avatarUrl: peer?.avatarUrl ?? null,
    matchReason: peer?.matchReason ?? null,
    lastMessage: hasMessages
      ? (conversation.lastMessageContent ?? '').trim()
      : '',
    lastMessageAt: hasMessages ? conversation.lastMessageAt : null,
    lastMessageSenderId: hasMessages
      ? conversation.lastMessageSenderId
      : null,
    timeLabel:
      hasMessages && conversation.lastMessageAt
        ? formatInboxTimeLabel(conversation.lastMessageAt, now)
        : '',
    unreadCount: conversation.unread,
    hasMessages,
    status: peer?.status === 'active' ? 'active' : 'pending',
  }
}

/**
 * Merge conversations with their matching peers by
 * `(matchId, otherUserId) === (peer.matchId, peer.userId)`. Conversations
 * without a peer still yield a thread with a `New match` fallback name.
 * Ordered by lastMessageAt desc (nulls last), then matchId desc.
 */
export function buildInboxThreads(opts: {
  conversations: InboxConversationInput[]
  peers: InboxPeerInput[]
  myUserId?: string
  now?: Date
}): InboxThread[] {
  const now = opts.now ?? new Date()
  const peersByKey = new Map<string, InboxPeerInput>()
  for (const peer of opts.peers) {
    peersByKey.set(`${peer.matchId}:${peer.userId}`, peer)
  }

  const threads = opts.conversations.map((conversation) =>
    buildInboxThread(
      conversation,
      peersByKey.get(`${conversation.matchId}:${conversation.otherUserId}`),
      now,
    ),
  )

  return threads.sort((a, b) => {
    const byTime = compareByLastMessageAt(a, b)
    if (byTime !== 0) return byTime
    return b.id.localeCompare(a.id)
  })
}

/** Idempotent: lastMessageAt desc (nulls last), then name asc for ties. */
export function sortInboxThreads(threads: InboxThread[]): InboxThread[] {
  return [...threads].sort((a, b) => {
    const byTime = compareByLastMessageAt(a, b)
    if (byTime !== 0) return byTime
    return a.name.localeCompare(b.name)
  })
}

export function filterInboxThreads(
  threads: InboxThread[],
  filter: InboxFilter,
): InboxThread[] {
  switch (filter) {
    case 'unread':
      return threads.filter((thread) => thread.unreadCount > 0)
    case 'new':
      return threads.filter((thread) => !thread.hasMessages)
    case 'all':
      return [...threads]
  }
}

export function totalUnread(threads: InboxThread[]): number {
  return threads.reduce((sum, thread) => sum + thread.unreadCount, 0)
}