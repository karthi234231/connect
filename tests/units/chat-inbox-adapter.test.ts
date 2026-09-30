import { describe, expect, it } from 'vitest'

import { avatarTone, getInitials } from '@/lib/chat/avatar'
import {
  buildInboxThreads,
  filterInboxThreads,
  formatInboxTime,
  sortInboxThreads,
  totalUnread,
  type InboxConversationInput,
  type InboxPeerInput,
  type InboxThread,
} from '@/lib/chat/inbox-adapter'

const NOW = new Date('2026-09-24T14:00:00Z')

describe('getInitials', () => {
  it('returns the first char of the first and last word', () => {
    expect(getInitials('Maya Okafor')).toBe('MO')
    expect(getInitials('  maya   okafor  ')).toBe('MO')
  })

  it('returns a single initial for a one-word name', () => {
    expect(getInitials('Maya')).toBe('M')
  })

  it('falls back for empty/whitespace input', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials('   ')).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })
})

describe('avatarTone', () => {
  const allowed = [
    'bg-amber-200',
    'bg-rose-200',
    'bg-sky-200',
    'bg-violet-200',
    'bg-emerald-200',
  ]

  it('is deterministic for the same seed', () => {
    expect(avatarTone('Maya Okafor')).toBe(avatarTone('Maya Okafor'))
    expect(avatarTone('')).toBe(avatarTone(''))
  })

  it('always returns an allowed tone', () => {
    expect(allowed).toContain(avatarTone('Maya Okafor'))
    expect(allowed).toContain(avatarTone(null))
    expect(allowed).toContain(avatarTone(undefined))
  })

  it('returns a valid tone for an empty seed', () => {
    expect(allowed).toContain(avatarTone(''))
  })
})

describe('buildInboxThreads', () => {
  it('merges a conversation with its matching peer', () => {
    const conversation: InboxConversationInput = {
      matchId: 'm-1',
      otherUserId: 'u-2',
      lastMessageAt: '2026-09-24T09:41:00Z',
      lastMessageContent: '  Hey there  ',
      lastMessageSenderId: 'u-2',
      unread: 2,
    }
    const peer: InboxPeerInput = {
      matchId: 'm-1',
      userId: 'u-2',
      fullName: 'Maya Okafor',
      avatarUrl: null,
      role: 'Mentor',
      status: 'active',
      matchReason: 'Common interests: product design',
    }

    const threads = buildInboxThreads({
      conversations: [conversation],
      peers: [peer],
      now: NOW,
    })

    expect(threads).toHaveLength(1)
    const thread = threads[0]
    expect(thread.id).toBe('m-1')
    expect(thread.peerUserId).toBe('u-2')
    expect(thread.name).toBe('Maya Okafor')
    expect(thread.initials).toBe('MO')
    expect(thread.tone).toBe(avatarTone('Maya Okafor'))
    expect(thread.avatarUrl).toBeNull()
    expect(thread.matchReason).toBe('Common interests: product design')
    expect(thread.lastMessage).toBe('Hey there')
    expect(thread.lastMessageAt).toBe('2026-09-24T09:41:00Z')
    expect(thread.hasMessages).toBe(true)
    expect(thread.unreadCount).toBe(2)
    expect(thread.status).toBe('active')
    expect(thread.timeLabel).toBeTruthy()
    expect(thread.timeLabel).toBe(formatInboxTime('2026-09-24T09:41:00Z', NOW))
  })

  it('emits a message-less thread with empty display fields', () => {
    const conversation: InboxConversationInput = {
      matchId: 'm-2',
      otherUserId: 'u-9',
      lastMessageAt: null,
      lastMessageContent: null,
      lastMessageSenderId: null,
      unread: 0,
    }

    const [thread] = buildInboxThreads({
      conversations: [conversation],
      peers: [],
      now: NOW,
    })

    expect(thread.hasMessages).toBe(false)
    expect(thread.lastMessage).toBe('')
    expect(thread.lastMessageAt).toBeNull()
    expect(thread.timeLabel).toBe('')
    expect(thread.unreadCount).toBe(0)
  })

  it('keeps empty display fields but maps peer identity + matchReason', () => {
    const conversation: InboxConversationInput = {
      matchId: 'm-2b',
      otherUserId: 'u-9',
      lastMessageAt: null,
      lastMessageContent: null,
      lastMessageSenderId: null,
      unread: 0,
    }
    const peer: InboxPeerInput = {
      matchId: 'm-2b',
      userId: 'u-9',
      fullName: 'Idris Adeyemi',
      avatarUrl: 'https://example.com/i.jpg',
      status: 'pending',
      matchReason: 'Same networks',
    }

    const [thread] = buildInboxThreads({
      conversations: [conversation],
      peers: [peer],
      now: NOW,
    })

    expect(thread.hasMessages).toBe(false)
    expect(thread.lastMessage).toBe('')
    expect(thread.lastMessageAt).toBeNull()
    expect(thread.timeLabel).toBe('')
    expect(thread.name).toBe('Idris Adeyemi')
    expect(thread.matchReason).toBe('Same networks')
    expect(thread.status).toBe('pending')
  })

  it('falls back to null matchReason when the peer omits it', () => {
    const [thread] = buildInboxThreads({
      conversations: [
        {
          matchId: 'm-4',
          otherUserId: 'u-2',
          lastMessageAt: '2026-09-24T09:41:00Z',
          lastMessageContent: 'hi',
          lastMessageSenderId: 'u-2',
          unread: 0,
        },
      ],
      peers: [
        {
          matchId: 'm-4',
          userId: 'u-2',
          fullName: 'Maya Okafor',
        },
      ],
      now: NOW,
    })

    expect(thread.matchReason).toBeNull()
  })

  it('emits a fallback thread when no peer matches', () => {
    const orphan: InboxConversationInput = {
      matchId: 'm-3',
      otherUserId: 'u-77',
      lastMessageAt: '2026-09-20T10:00:00Z',
      lastMessageContent: 'Hello',
      lastMessageSenderId: 'u-77',
      unread: 1,
    }

    const [thread] = buildInboxThreads({
      conversations: [orphan],
      peers: [],
      now: NOW,
    })

    expect(thread.name).toBe('New match')
    expect(thread.peerUserId).toBe('u-77')
    expect(thread.initials).toBe(getInitials('u-77'))
    expect(thread.tone).toBe(avatarTone('u-77'))
    expect(thread.avatarUrl).toBeNull()
    expect(thread.status).toBe('pending')
    expect(thread.matchReason).toBeNull()
  })

  it('orders by lastMessageAt desc with no-message threads last', () => {
    const message = (id: string, at: string | null): InboxConversationInput => ({
      matchId: id,
      otherUserId: `peer-${id}`,
      lastMessageAt: at,
      lastMessageContent: at ? 'hi' : null,
      lastMessageSenderId: at ? `peer-${id}` : null,
      unread: 0,
    })

    const threads = buildInboxThreads({
      conversations: [
        message('m-empty', null),
        message('m-old', '2026-09-20T10:00:00Z'),
        message('m-new', '2026-09-24T09:41:00Z'),
      ],
      peers: [],
      now: NOW,
    })

    expect(threads.map((t) => t.id)).toEqual([
      'm-new',
      'm-old',
      'm-empty',
    ])
  })

  it('breaks timestamp ties by matchId desc', () => {
    const sameTime = (id: string): InboxConversationInput => ({
      matchId: id,
      otherUserId: `peer-${id}`,
      lastMessageAt: '2026-09-24T09:41:00Z',
      lastMessageContent: 'hi',
      lastMessageSenderId: `peer-${id}`,
      unread: 0,
    })

    const threads = buildInboxThreads({
      conversations: [sameTime('m-a'), sameTime('m-b')],
      peers: [],
      now: NOW,
    })

    expect(threads.map((t) => t.id)).toEqual(['m-b', 'm-a'])
  })
})

describe('filterInboxThreads', () => {
  function sampleThreads(): InboxThread[] {
    const thread = (
      id: string,
      at: string | null,
      unread: number,
    ): InboxConversationInput => ({
      matchId: id,
      otherUserId: `peer-${id}`,
      lastMessageAt: at,
      lastMessageContent: at ? 'hi' : null,
      lastMessageSenderId: at ? `peer-${id}` : null,
      unread,
    })

    return buildInboxThreads({
      conversations: [
        thread('m-read', '2026-09-24T09:00:00Z', 0),
        thread('m-unread', '2026-09-24T10:00:00Z', 3),
        thread('m-new', null, 0),
      ],
      peers: [],
      now: NOW,
    })
  }

  it("returns everything for 'all' (as a new array)", () => {
    const input = sampleThreads()
    const result = filterInboxThreads(input, 'all')
    expect(result).toEqual(input)
    expect(result).not.toBe(input)
  })

  it("returns only threads with unread messages for 'unread'", () => {
    const threads = sampleThreads()
    expect(filterInboxThreads(threads, 'unread').map((t) => t.id)).toEqual([
      'm-unread',
    ])
  })

  it("returns only message-less threads for 'new'", () => {
    const threads = sampleThreads()
    expect(filterInboxThreads(threads, 'new').map((t) => t.id)).toEqual([
      'm-new',
    ])
  })
})

describe('sortInboxThreads', () => {
  function thread(id: string, at: string | null, name: string): InboxThread {
    return buildInboxThreads({
      conversations: [
        {
          matchId: id,
          otherUserId: `peer-${id}`,
          lastMessageAt: at,
          lastMessageContent: at ? 'hi' : null,
          lastMessageSenderId: null,
          unread: 0,
        },
      ],
      peers: [
        {
          matchId: id,
          userId: `peer-${id}`,
          fullName: name,
        },
      ],
      now: NOW,
    })[0]
  }

  it('sorts by lastMessageAt desc, nulls last', () => {
    const sorted = sortInboxThreads([
      thread('m-none', null, 'Zoe'),
      thread('m-old', '2026-09-20T10:00:00Z', 'Yara'),
      thread('m-new', '2026-09-24T09:41:00Z', 'Xena'),
    ])

    expect(sorted.map((t) => t.id)).toEqual(['m-new', 'm-old', 'm-none'])
  })

  it('ties break by name asc and the sort is idempotent', () => {
    const first = sortInboxThreads([
      thread('m-beta', '2026-09-24T09:41:00Z', 'Beta'),
      thread('m-alpha', '2026-09-24T09:41:00Z', 'Alpha'),
    ])

    expect(first.map((t) => t.id)).toEqual(['m-alpha', 'm-beta'])
    expect(sortInboxThreads(first).map((t) => t.id)).toEqual([
      'm-alpha',
      'm-beta',
    ])
  })
})

describe('totalUnread', () => {
  it('sums unread counts across threads', () => {
    const threads = buildInboxThreads({
      conversations: [
        {
          matchId: 'm-1',
          otherUserId: 'u-1',
          lastMessageAt: '2026-09-24T09:00:00Z',
          lastMessageContent: 'hi',
          lastMessageSenderId: 'u-1',
          unread: 2,
        },
        {
          matchId: 'm-2',
          otherUserId: 'u-2',
          lastMessageAt: null,
          lastMessageContent: null,
          lastMessageSenderId: null,
          unread: 0,
        },
        {
          matchId: 'm-3',
          otherUserId: 'u-3',
          lastMessageAt: '2026-09-24T10:00:00Z',
          lastMessageContent: 'yo',
          lastMessageSenderId: 'u-3',
          unread: 5,
        },
      ],
      peers: [],
      now: NOW,
    })

    expect(totalUnread(threads)).toBe(7)
  })
})

describe('formatInboxTime', () => {
  it('returns empty for null/empty/invalid input', () => {
    expect(formatInboxTime(null)).toBe('')
    expect(formatInboxTime('')).toBe('')
    expect(formatInboxTime('not-a-date')).toBe('')
  })

  it('renders a weekday for a recent non-today date', () => {
    const now = new Date('2026-09-24T14:00:00Z')
    const iso = '2026-09-20T09:41:00Z'
    const expected = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
    }).format(new Date(iso))
    expect(formatInboxTime(iso, now)).toBe(expected)
  })

  it('renders a month-day for dates older than a week', () => {
    const now = new Date('2026-09-24T14:00:00Z')
    const iso = '2026-08-01T09:41:00Z'
    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
    expect(formatInboxTime(iso, now)).toBe(expected)
  })

  it('renders a wall-clock time like "9:41 AM" for a timestamp today', () => {
    const now = new Date('2026-09-24T14:00:00Z')
    const iso = '2026-09-24T09:41:00Z'
    const expected = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
    expect(formatInboxTime(iso, now)).toBe(expected)
    expect(formatInboxTime(iso, now)).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i)
  })

  it('keeps a weekday label for yesterday (no "Yesterday" copy)', () => {
    const now = new Date('2026-09-24T14:00:00Z')
    const iso = '2026-09-23T09:41:00Z'
    const expected = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
    }).format(new Date(iso))
    expect(formatInboxTime(iso, now)).not.toBe('Yesterday')
    expect(formatInboxTime(iso, now)).toBe(expected)
  })
})