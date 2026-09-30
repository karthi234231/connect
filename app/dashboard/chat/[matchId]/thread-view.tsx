'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search, Sparkles, X } from 'lucide-react'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchMatches } from '@/client/api/matches'
import { MemberProfileDialog } from '@/components/people'
import {
  dismissRelationshipSuggestionAction,
  getDismissedSuggestionSourcesAction,
  getMessagesAction,
} from '@/app/actions/chat'
import {
  getChatReactions,
  markConversationRead,
  removeChatReaction,
  sendChatMessage,
  toggleChatReaction,
  watchMessages,
} from '@/client/api/chat'
import {
  applyReactionToggle,
  groupReactionsByMessage,
  isMessageReaction,
  type MessageReaction,
  type ReactionRecord,
} from '@/lib/chat/reactions'
import {
  MessageComposer,
  type ComposerSendDraft,
} from '@/components/chat/MessageComposer'
import { MessageList, type ChatMessage } from '@/components/chat/message-list'
import { ErrorState } from '@/components/states/ErrorState'
import { cn } from '@/utils/cn'
import {
  RELATIONSHIP_SUGGESTION_SOURCES,
  type RelationshipSuggestionSource,
} from '@/lib/chat/momentum'
import { useChatConnection } from '@/hooks/use-chat-connection'
import { useLiveRegion } from '@/hooks/use-live-region'
import {
  mergeRealtimeMessage,
  optimisticMessageId,
  type MessagePayload,
  type ReactionPayload,
  type ReceiptPayload,
} from '@/lib/chat/realtime'
import { extractClientMessageId } from '@/lib/chat/message-state'
import type { MessageSummary } from '@/types/message'
import type { Message } from '@/services/chat/mappers'

const SUGGESTION_LABELS: Record<RelationshipSuggestionSource, string> = {
  shared_interest: 'Shared interests',
  shared_skill: 'Shared skills',
  complementary_skill: 'Complementary skills',
  shared_event: 'Shared event',
  shared_idea: 'Shared idea',
  same_city: 'Same city',
  conversation_gap: 'Conversation follow-up',
}

const DAY_MS = 24 * 60 * 60 * 1000

/** µ-04 — throttle `sendTyping(true)` publishes during continuous typing. */
const TYPING_PUBLISH_INTERVAL_MS = 1000
/** M-03 — pending/confirmed correlation window (server clock vs client clock). */
const PENDING_CONFIRM_TOLERANCE_MS = 5 * 60 * 1000

const clockTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "Today" / "Yesterday" / "Sep 24" chip label for a calendar-day group. */
function dayLabel(iso: string, now: Date): string | undefined {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return shortDayFormatter.format(date)
}

/**
 * M-08 — group a chronologically ordered (newest-last) message list into
 * per-calendar-day runs, each with a divider chip label.
 */
function groupThreadMessagesByDay(
  messages: readonly ThreadMessage[],
): { groups: ThreadMessage[][]; labels: (string | undefined)[] } {
  const groups: ThreadMessage[][] = []
  const labels: (string | undefined)[] = []
  const now = new Date()
  let currentKey: string | null = null
  let current: ThreadMessage[] = []

  for (const message of messages) {
    const date = new Date(message.created_at)
    if (Number.isNaN(date.getTime())) continue
    const key = localDayKey(date)
    if (currentKey === null || key !== currentKey) {
      if (current.length > 0) {
        groups.push(current)
        labels.push(dayLabel(current[0]!.created_at, now))
      }
      current = [message]
      currentKey = key
    } else {
      current.push(message)
    }
  }
  if (current.length > 0) {
    groups.push(current)
    labels.push(dayLabel(current[0]!.created_at, now))
  }
  return { groups, labels }
}

/** `client/api/chat.ts#watchMessages` row → local thread row. */
function mapSummaryToThread(m: MessageSummary): ThreadMessage {
  return {
    id: m.id,
    content: m.content,
    created_at: m.created_at,
    sender_id: m.sender_id,
    attachmentUrl: m.attachment_url ?? null,
    read_at: m.read_at ?? null,
  }
}

/** Server `Message` (camelCase, `services/chat/mappers.ts`) → local thread row. */
function serviceMessageToThread(m: Message): ThreadMessage {
  return {
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    sender_id: m.senderId,
    attachmentUrl: m.attachmentUrl ?? null,
    read_at: m.readAt ?? null,
  }
}

interface ThreadMessage {
  id: string
  content: string
  created_at: string
  sender_id: string
  attachmentUrl?: string | null
  read_at?: string | null
  /** Optimistic-only delivery state. Confirmed rows leave this unset. */
  status?: 'pending' | 'failed'
  /** Idempotency key for optimistic rows; absent on confirmed rows. */
  clientMessageId?: string
}

interface ThreadViewProps {
  matchId: string
  myId: string
  peer: { id?: string; fullName: string; role: string | null; avatarUrl: string | null }
  /**
   * Render as an inline panel (two-pane chat list) without the full-page
   * main/header chrome. Defaults to the standalone full-page thread view.
   */
  embedded?: boolean
}

/**
 * W-06 — mint the raw client idempotency key (a bare UUID, no prefix). The
 * placeholder bubble id is derived separately via `optimisticMessageId`, and
 * sends/retries always pass the raw key so the server echo can be correlated.
 */
function newClientMessageId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function attachmentCaption(draft: ComposerSendDraft): string {
  if (draft.text.trim().length > 0) return draft.text.trim()
  return draft.attachmentName ?? 'Attachment'
}

/** L-01 — pulse bubble rows shown while the thread query is loading. */
function MessageSkeletonRows() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-hidden px-4 py-5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className={cn(
            'flex w-full animate-pulse items-end',
            index % 2 === 1 ? 'justify-end' : 'justify-start',
          )}
        >
          <div
            className={cn(
              'h-10 w-2/3 rounded-2xl bg-[var(--cx-surface-3)]',
              index % 2 === 1 ? 'rounded-br-md' : 'rounded-tl-md',
            )}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * IO-05 — server chat actions return `{ ok: false, error }` on failure instead
 * of throwing. This mirrors `client/api/chat.ts`'s `unwrap` helper verbatim so
 * M-04's load-earlier path can ride the action boundary (the client page
 * helper `fetchMessagesPage` has not landed yet) with the same throwing
 * semantics the chat UI try/catches rely on.
 */
async function unwrapMessagesPage<T>(
  p: Promise<T | { ok: false; error: string }>,
): Promise<T> {
  const r = await p
  if (r && typeof r === 'object' && 'ok' in r && r.ok === false) {
    throw new Error(r.error)
  }
  return r as T
}

/**
 * "Getting to know each other" — relationship-suggestion surface (V10-BE-01/02).
 * Reads which canonical suggestion sources the viewer already dismissed via
 * `getDismissedSuggestionSourcesAction`, renders the remaining sources as
 * chips, and lets the viewer dismiss each one via the existing dismiss action.
 */
function RelationshipSuggestionsCard({
  matchId,
  peerName,
}: {
  matchId: string
  peerName: string
}) {
  const [open, setOpen] = useState(true)
  const [key] = useState(() => ['chat', 'suggestions', matchId].join('/'))
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    getDismissedSuggestionSourcesAction(matchId),
  )
  const [dismissing, setDismissing] =
    useState<RelationshipSuggestionSource | null>(null)
  const [dismissError, setDismissError] = useState<string | null>(null)

  const dismissed = new Set(data ?? [])
  const available = RELATIONSHIP_SUGGESTION_SOURCES.filter(
    (source) => !dismissed.has(source),
  )

  async function handleDismiss(source: RelationshipSuggestionSource) {
    if (dismissing) return
    setDismissing(source)
    setDismissError(null)
    try {
      await dismissRelationshipSuggestionAction(matchId, source)
      await refetch()
    } catch {
      setDismissError(
        'That suggestion could not be dismissed. Please try again.',
      )
    } finally {
      setDismissing(null)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--cx-text-2)]">
          <Sparkles className="size-3.5 text-[var(--cx-brand-strong)]" />
          Getting to know each other
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 text-[var(--cx-text-4)] transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>

      {open ? (
        <div className="px-3 pb-3">
          {isLoading ? (
            <p className="text-xs text-[var(--cx-text-4)]">Loading…</p>
          ) : error ? (
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs text-[var(--cx-text-3)] underline-offset-2 hover:underline"
            >
              Suggestions failed to load — tap to retry.
            </button>
          ) : available.length === 0 ? (
            <p className="text-xs leading-5 text-[var(--cx-text-4)]">
              Suggested topics you haven&apos;t covered yet will appear here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
                >
                  {SUGGESTION_LABELS[source]}
                  <button
                    type="button"
                    aria-label={`Dismiss ${SUGGESTION_LABELS[source]}`}
                    disabled={dismissing !== null}
                    onClick={() => void handleDismiss(source)}
                    className="rounded-full text-[var(--cx-text-4)] transition hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {dismissError ? (
            <p role="alert" className="mt-2 text-xs text-[var(--cx-danger)]">
              {dismissError}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] leading-4 text-[var(--cx-text-4)]">
            Topics from your shared profile with {peerName}. Dismiss the ones
            you&apos;ve already covered.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function ThreadView({
  matchId,
  myId,
  peer,
  embedded = false,
}: ThreadViewProps) {
  const { polite: announce } = useLiveRegion()
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const threadKey = keys.messages(matchId).join('/')
  const { data, isLoading, error, refetch } = useQuery(threadKey, () =>
    watchMessages({ matchId, limit: 50 }),
  )
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pending, setPending] = useState<ThreadMessage[]>([])
  const [realtimeAppended, setRealtimeAppended] = useState<ThreadMessage[]>([])
  const [earlierMessages, setEarlierMessages] = useState<ThreadMessage[]>([])
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const [reactionsData, setReactionsData] = useState<ReactionRecord[]>([])
  /** I-02/onReceipt — local `read_at` patches (double-check ticks) pre-refetch. */
  const [readAtOverrides, setReadAtOverrides] = useState<Record<string, string>>(
    {},
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingPublishRef = useRef(0)
  const [nearBottom, setNearBottom] = useState(true)
  const seenInboundRef = useRef<Set<string>>(new Set())
  const lastInboundIdsRef = useRef<Set<string>>(new Set())
  const [newMessagesSinceScroll, setNewMessagesSinceScroll] = useState(0)
  const serverMessagesRef = useRef<ThreadMessage[]>([])
  const allConfirmedRef = useRef<ThreadMessage[]>([])

  // Thread search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)

  const refetchRef = useRef(refetch)
  useEffect(() => {
    refetchRef.current = refetch
  })

  // Realtime identity/mappers (canonical contract in lib/chat/realtime.ts).
  // The local thread row carries the same data as `MessagePayload` under the
  // legacy snake_case field names, so the adapter bridges once. The rows
  // `mergeRealtimeMessage` returns are the originals (it only inserts + sorts,
  // never projects through `toPayload`), so the casts are identity-preserving.
  const threadMessageToPayload = (m: ThreadMessage): MessagePayload => ({
    matchId,
    id: m.id,
    senderId: m.sender_id,
    content: m.content,
    createdAt: m.created_at,
    ...(m.clientMessageId ? { clientMessageId: m.clientMessageId } : {}),
  })

  const mergeIncomingThreadMessage = (
    current: readonly ThreadMessage[],
    incoming: ThreadMessage,
  ): ThreadMessage[] =>
    mergeRealtimeMessage(
      current as unknown as readonly MessagePayload[],
      incoming as unknown as MessagePayload,
      threadMessageToPayload as unknown as (
        message: MessagePayload,
      ) => MessagePayload,
    ) as unknown as ThreadMessage[]

  function realtimeToThread(payload: MessagePayload): ThreadMessage {
    return {
      id: payload.id,
      content: payload.content,
      created_at: payload.createdAt,
      sender_id: payload.senderId,
      attachmentUrl: null,
      ...(payload.clientMessageId
        ? { clientMessageId: payload.clientMessageId }
        : {}),
    }
  }

  // Realtime delivery accelerators (P1). Peer messages/reactions/receipts
  // converge instantly instead of waiting for the 10s poll.
  const handleRealtimeMessage = (payload: MessagePayload) => {
    // The connection hook already drops own echoes (actorId === myId); guard
    // again defensively so a local echo can never double-append.
    if (payload.senderId === myId) return
    setRealtimeAppended((prev) => {
      if (prev.some((p) => p.id === payload.id)) return prev
      if (allConfirmedRef.current.some((m) => m.id === payload.id)) return prev
      return [...prev, realtimeToThread(payload)]
    })
    // Reconcile the authoritative page (fills attachments/read_at the realtime
    // envelope does not carry). The overlay survives overwrites until the
    // server row is actually present, so the merged bubble never flickers.
    void refetch().catch(() => undefined)
  }

  const handleRealtimeReaction = (payload: ReactionPayload) => {
    if (!isMessageReaction(payload.emoji)) return
    // Narrow outside the updater callback — narrower scopes don't carry the
    // type-guard narrowing on `payload.emoji` into the closure.
    const emoji: MessageReaction = payload.emoji
    setReactionsData((prev) =>
      applyReactionToggle(prev, {
        messageId: payload.messageId,
        userId: payload.userId,
        emoji,
        active: payload.active,
      }),
    )
  }

  const handleRealtimeReceipt = (payload: ReceiptPayload) => {
    if (payload.readerId === myId) return
    const confirmed = serverMessagesRef.current
    setReadAtOverrides((prev) => {
      let changed = false
      const next = { ...prev }
      for (const message of confirmed) {
        if (message.sender_id !== myId) continue
        // Only recency-bounded receipts and never clobber an authoritative
        // `read_at` already returned by the server.
        if (message.read_at) continue
        if (message.created_at > payload.readAt) continue
        if (next[message.id] === payload.readAt) continue
        next[message.id] = payload.readAt
        changed = true
      }
      return changed ? next : prev
    })
  }

  const handleRealtimeReconnect = () => {
    void refetch().catch(() => undefined)
  }

  const { isPeerTyping, sendTyping } = useChatConnection(matchId, {
    myId,
    onMessage: handleRealtimeMessage,
    onReaction: handleRealtimeReaction,
    onReceipt: handleRealtimeReceipt,
    onReconnect: handleRealtimeReconnect,
  })

  const rawServerMessages: ThreadMessage[] = (data ?? []).map(
    mapSummaryToThread,
  )
  const serverMessages = rawServerMessages.map((m) => {
    const override = readAtOverrides[m.id]
    return override && !m.read_at ? { ...m, read_at: override } : m
  })
  const allConfirmed: ThreadMessage[] = [...earlierMessages, ...serverMessages]

  // Keep the realtime handlers' read snapshots aligned with the latest render.
  // Same idiom as `message-list.tsx` replaying `onNearBottomChange` through a
  // ref — run after every render, never during it.
  useEffect(() => {
    serverMessagesRef.current = serverMessages
    allConfirmedRef.current = allConfirmed
  })

  // W-06/M-03 — the confirmed+optimistic rows with realtime overlays merged
  // through the canonical merge helper (correlates `optimistic-` placeholders
  // against their server echo and drops duplicates).
  const mergedConfirmed = realtimeAppended.reduce(
    (acc, message) => mergeIncomingThreadMessage(acc, message),
    [...allConfirmed, ...pending],
  )
  const visible: ThreadMessage[] = []
  {
    const seen = new Set<string>()
    for (const message of mergedConfirmed) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      visible.push(message)
    }
  }

  const matchingIds = visible
    .filter((m) =>
      searchQuery.trim()
        ? m.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
        : false,
    )
    .map((m) => m.id)

  const matchingCount = matchingIds.length
  const activeMatchId = matchingIds[activeSearchIndex] ?? null

  useEffect(() => {
    if (!searchQuery.trim() || !activeMatchId) return
    const el = document.getElementById(`message-${activeMatchId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeMatchId, searchQuery])

  const visibleIdKey = visible.map((m) => m.id).join(',')

  useEffect(() => {
    const messageIds = visible
      .filter((m) => !m.id.startsWith('optimistic-'))
      .map((m) => m.id)
      .slice(0, 100)
    if (messageIds.length === 0) return
    let active = true
    void getChatReactions(matchId, messageIds)
      .then((res) => {
        if (active) setReactionsData(res)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
    // Keyed on the ordered message-id string so peer reactions can ride
    // `onReaction` without waiting for a deps-keyed refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, visibleIdKey])

  const messageReactionsMap = groupReactionsByMessage(reactionsData, myId)

  const handleToggleReaction = async (
    messageId: string,
    emoji: MessageReaction,
  ) => {
    const existingSummaries = messageReactionsMap[messageId] ?? []
    const existingChip = existingSummaries.find((r) => r.emoji === emoji)
    const isRemoving = existingChip?.reactedByViewer ?? false

    const toggle = {
      messageId,
      userId: myId,
      emoji,
      active: !isRemoving,
    }
    setReactionsData((prev) => applyReactionToggle(prev, toggle))

    try {
      if (isRemoving) {
        await removeChatReaction(messageId, emoji)
      } else {
        await toggleChatReaction(messageId, emoji)
      }
    } catch {
      setReactionsData((prev) =>
        applyReactionToggle(prev, { ...toggle, active: isRemoving }),
      )
      announce('Could not update reaction. Please try again.')
    }
  }

  useEffect(() => {
    if (searchQuery.trim() || !nearBottom) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [visible.length, isPeerTyping, searchQuery, nearBottom])

  // Poll — reconciles the authoritative page every 10s regardless of a
  // transient refetch error, so an M-03 optimistic bubble that survived a
  // failed `refetch()` is reconciled by the very next poll.
  useEffect(() => {
    const timer = setInterval(() => {
      void refetchRef.current().catch(() => undefined)
    }, 10000)
    return () => clearInterval(timer)
  }, [matchId])

  // M-03 — never drop a pending bubble early. Once the refetched data carries
  // a confirmed row for the same (sender, content, attachment) inside the
  // clock-tolerance window, one-to-one match removes the placeholder. A
  // bubble whose row is still absent stays `pending` and reconciles on the
  // next poll; `failed` rows are only removed by an explicit retry.
  useEffect(() => {
    // Reconcile the optimistic placeholder against the authoritative `data`
    // page only after it lands; a render-time prune cannot observe post-fetch
    // state, and this effect is deliberately keyed on the query result.
    // Steered around `set-state-in-effect`: the transition is data-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending((prev) => {
      if (prev.length === 0) return prev
      const rows = (data ?? [])
        .map(mapSummaryToThread)
        .filter((r) => r.sender_id === myId && !r.id.startsWith('optimistic-'))
      if (rows.length === 0) return prev
      const keepFailed = prev.filter((p) => p.status === 'failed')
      const active = prev.filter((p) => p.status !== 'failed')
      if (active.length === 0) return prev

      const isConfirmedByRow = (p: ThreadMessage, row: ThreadMessage): boolean =>
        p.sender_id === row.sender_id &&
        p.content === row.content &&
        (p.attachmentUrl ?? null) === (row.attachmentUrl ?? null) &&
        (() => {
          const a = new Date(p.created_at).getTime()
          const b = new Date(row.created_at).getTime()
          if (Number.isNaN(a) || Number.isNaN(b)) return false
          return Math.abs(a - b) <= PENDING_CONFIRM_TOLERANCE_MS
        })()

      const matched = new Set<string>()
      for (const row of rows) {
        const target = active.find(
          (p) => !matched.has(p.id) && isConfirmedByRow(p, row),
        )
        if (target) matched.add(target.id)
      }
      if (matched.size === 0) return prev
      const next = [...keepFailed, ...active.filter((p) => !matched.has(p.id))]
      const orderIndex = new Map(prev.map((p, index) => [p.id, index]))
      next.sort(
        (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
      )
      return next
    })
  }, [data, myId])

  // Prune realtime overlays once their authoritative row appears in the
  // confirmed pages (server data or a loaded-earlier page).
  useEffect(() => {
    // Drop realtime overlays only once their authoritative row is on the
    // confirmed pages; a render-time prune would race the just-landed
    // `data`/`earlierMessages` fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRealtimeAppended((prev) => {
      if (prev.length === 0) return prev
      const known = new Set<string>()
      for (const m of earlierMessages) known.add(m.id)
      for (const m of data ?? []) known.add(m.id)
      const next = prev.filter((p) => !known.has(p.id))
      return next.length === prev.length ? prev : next
    })
  }, [data, earlierMessages])

  // Drop local read receipts that the server has now made authoritative (or
  // whose message no longer exists).
  useEffect(() => {
    // Prune local receipt patches once the refetched page carries the
    // authoritative `read_at` (or the message no longer exists).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadAtOverrides((prev) => {
      const ids = Object.keys(prev)
      if (ids.length === 0) return prev
      const rows = data ?? []
      let changed = false
      const next: Record<string, string> = {}
      for (const id of ids) {
        const row = rows.find((m) => m.id === id)
        if (!row || row.read_at) {
          changed = true
          continue
        }
        next[id] = prev[id]
      }
      return changed ? next : prev
    })
  }, [data])

  // I-02 — re-mark the conversation read whenever freshly-seen inbound
  // messages appear while the viewer is reading at the bottom, then keep the
  // inbox unread badge converged with a refresh event.
  const inboundIdsKey = visible
    .filter((m) => m.sender_id !== myId && !m.id.startsWith('optimistic-'))
    .map((m) => m.id)
    .join(',')

  useEffect(() => {
    const freshIds: string[] = []
    if (inboundIdsKey) {
      for (const id of inboundIdsKey.split(',')) {
        if (!seenInboundRef.current.has(id)) freshIds.push(id)
      }
    }
    if (freshIds.length === 0) return
    if (!nearBottom) return
    for (const id of freshIds) seenInboundRef.current.add(id)
    void markConversationRead(matchId)
      .then(() => {
        window.dispatchEvent(new CustomEvent('chat:inbox-refresh'))
      })
      .catch(() => undefined)
  }, [matchId, inboundIdsKey, nearBottom])

  // M-09 — count inbound messages that land while the viewer is scrolled up;
  // the message-list FAB surfaces them and reset happens on scroll-to-bottom.
  useEffect(() => {
    const nextIds = new Set<string>()
    if (inboundIdsKey) {
      for (const id of inboundIdsKey.split(',')) nextIds.add(id)
    }
    if (nearBottom) {
      lastInboundIdsRef.current = nextIds
      // Reset the count whenever the snapshot flips to the bottom of the
      // scroll container; a render-time expression could not see it either.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewMessagesSinceScroll(0)
      return
    }
    let added = 0
    for (const id of nextIds) {
      if (!lastInboundIdsRef.current.has(id)) added += 1
    }
    lastInboundIdsRef.current = nextIds
    if (added > 0) {
      setNewMessagesSinceScroll((count) => count + added)
    }
  }, [inboundIdsKey, nearBottom])

  const handleScrollToBottom = () => {
    setNewMessagesSinceScroll(0)
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }

  // M-04 — load older pages. `client/api/chat.ts` does not yet export
  // `fetchMessagesPage` at this revision, so load-earlier rides on the
  // `getMessagesAction` adapter (which preserves the server page contract
  // `{ messages, nextCursor }` until the other agent lands the page helper).
  useEffect(() => {
    cursorRef.current = null
    let active = true
    void unwrapMessagesPage(getMessagesAction({ matchId, limit: 50 }))
      .then((page) => {
        if (!active) return
        cursorRef.current = page.nextCursor ?? null
        setHasEarlier(page.nextCursor != null)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [matchId])

  async function handleLoadEarlier() {
    if (loadingEarlier) return
    const cursor = cursorRef.current
    setLoadingEarlier(true)
    try {
      const page = await unwrapMessagesPage(
      getMessagesAction({
        matchId,
        limit: 50,
        ...(cursor ? { cursor } : {}),
      }),
    )
      setEarlierMessages((prev) => [
        ...page.messages.map(serviceMessageToThread),
        ...prev,
      ])
      cursorRef.current = page.nextCursor ?? null
      setHasEarlier(page.nextCursor != null)
    } catch {
      announce('Earlier messages could not be loaded.')
    } finally {
      setLoadingEarlier(false)
    }
  }

  // Reset per-thread local state when the embedded panel switches matches.
  useEffect(() => {
    // The embedded panel swaps conversations via `matchId`; its whole derived
    // local state must reset in one step rather than re-derive mid-swap.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending([])
    setRealtimeAppended([])
    setEarlierMessages([])
    setHasEarlier(false)
    setLoadingEarlier(false)
    cursorRef.current = null
    setReactionsData([])
    setReadAtOverrides({})
    setNewMessagesSinceScroll(0)
    setNearBottom(true)
    seenInboundRef.current = new Set()
    lastInboundIdsRef.current = new Set()
    lastTypingPublishRef.current = 0
    setSearchQuery('')
    setSearchOpen(false)
    setActiveSearchIndex(0)
  }, [matchId])

  // µ-04 — throttle `sendTyping(true)` to ~1/s during continuous typing,
  // always flushing a trailing `false` on stop (existing timer preserved).
  const handleDraftChange = (text: string) => {
    if (!sendTyping) return
    if (text.length > 0) {
      const now = Date.now()
      if (now - lastTypingPublishRef.current >= TYPING_PUBLISH_INTERVAL_MS) {
        lastTypingPublishRef.current = now
        sendTyping(true)
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        sendTyping?.(false)
      }, 2500)
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      sendTyping(false)
    }
  }

  async function handleOpenPeerProfile() {
    if (profileUserId) {
      setProfileUserId(null)
      return
    }
    if (peer?.id) {
      setProfileUserId(peer.id)
      return
    }
    if (!peer?.fullName) return
    try {
      const matches = await fetchMatches()
      const match = matches.find((m) => m.matchId === matchId)
      if (match?.otherUser?.id) {
        setProfileUserId(match.otherUser.id)
      }
    } catch {
      announce('Could not open this profile right now.')
    }
  }

  async function handleSend(draft: ComposerSendDraft): Promise<boolean> {
    if (sending) return false
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTyping?.(false)
    lastTypingPublishRef.current = 0
    const content = attachmentCaption(draft)
    setSending(true)
    setSendError(null)
    const clientMessageId = newClientMessageId()
    const optimistic: ThreadMessage = {
      id: optimisticMessageId(clientMessageId),
      clientMessageId,
      content,
      created_at: new Date().toISOString(),
      sender_id: myId,
      attachmentUrl: draft.attachmentUrl ?? null,
      status: 'pending',
    }
    setPending((prev) => [...prev, optimistic])
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
    try {
      await sendChatMessage({
        matchId,
        content,
        clientMessageId,
        ...(draft.attachmentUrl ? { attachmentUrl: draft.attachmentUrl } : {}),
      })
      // M-03 — keep the placeholder (no pre-refetch removal): it stays
      // `pending` until the reconciled page confirms the persisted row, so
      // the send never flickers into an unconfirmed gap.
      await refetch()
      announce('Message sent')
      window.dispatchEvent(new CustomEvent('chat:inbox-refresh'))
      return true
    } catch {
      // Keep the bubble so the user's text survives; it flips to the failed
      // state and gains a retry affordance wired to `handleRetryMessage`.
      setPending((prev) =>
        prev.map((p) =>
          p.id === optimistic.id ? { ...p, status: 'failed' } : p,
        ),
      )
      setSendError('Message could not be sent. Please try again.')
      announce('Message could not be sent. Please try again.')
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleRetryMessage(messageId: string) {
    if (sending) return
    const failed = pending.find((p) => p.id === messageId)
    if (!failed) return
    setSending(true)
    setSendError(null)
    setPending((prev) =>
      prev.map((p) =>
        p.id === messageId ? { ...p, status: 'pending' } : p,
      ),
    )
    try {
      const clientMessageId =
        failed.clientMessageId ??
        extractClientMessageId(failed.id) ??
        newClientMessageId()
      await sendChatMessage({
        matchId,
        content: failed.content,
        clientMessageId,
        ...(failed.attachmentUrl
          ? { attachmentUrl: failed.attachmentUrl }
          : {}),
      })
      // M-03 — the retried bubble stays `pending` until the reconcile
      // confirms the persisted row (same idempotency key, no double-write).
      await refetch()
      announce('Message sent')
      window.dispatchEvent(new CustomEvent('chat:inbox-refresh'))
    } catch {
      setPending((prev) =>
        prev.map((p) =>
          p.id === messageId ? { ...p, status: 'failed' } : p,
        ),
      )
      setSendError('Message could not be sent. Please try again.')
      announce('Message could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const groupedByDay = groupThreadMessagesByDay(visible)
  const chatMessageGroups: ChatMessage[][] = groupedByDay.groups.map((group) =>
    group.map((m) => {
      const isSent = m.sender_id === myId
      let status: 'sent' | 'read' | 'pending' | 'failed' | undefined = undefined
      if (isSent) {
        if (m.status === 'failed') {
          status = 'failed'
        } else if (m.status === 'pending') {
          status = 'pending'
        } else if (m.read_at) {
          status = 'read'
        } else {
          status = 'sent'
        }
      }

      return {
        id: m.id,
        text: m.content,
        sent: isSent,
        // M-08 — absolute clock time, not relative.
        time: clockTimeFormatter.format(new Date(m.created_at)),
        status,
        attachmentUrl: m.attachmentUrl,
        attachmentName: m.attachmentUrl
          ? m.attachmentUrl.split('/').pop() ?? 'Attachment'
          : null,
        reactions: messageReactionsMap[m.id] ?? [],
        searchQuery: searchQuery.trim() || undefined,
        isActiveSearchMatch: m.id === activeMatchId,
      }
    }),
  )
  const groupLabels: (string | undefined)[] = groupedByDay.labels
  const chatMessageCount = chatMessageGroups.reduce(
    (count, group) => count + group.length,
    0,
  )

  const renderSearchBar = () => (
    <>
      {searchOpen || searchQuery.trim() ? (
        <div className="relative flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-1.5 transition-all focus-within:border-[var(--cx-brand)]">
          <Search className="size-3.5 shrink-0 text-[var(--cx-text-3)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setActiveSearchIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('')
                setSearchOpen(false)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (matchingCount > 0) {
                  setActiveSearchIndex((prev) => (prev + 1) % matchingCount)
                }
              }
            }}
            placeholder="Search in thread…"
            className="w-28 bg-transparent text-xs text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)] sm:w-44"
            autoFocus
          />
          {searchQuery.trim() ? (
            <span className="text-[10px] font-medium text-[var(--cx-text-3)] whitespace-nowrap">
              {matchingCount > 0
                ? `${activeSearchIndex + 1}/${matchingCount}`
                : '0 matches'}
            </span>
          ) : null}
          {matchingCount > 1 ? (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setActiveSearchIndex((prev) =>
                    prev > 0 ? prev - 1 : matchingCount - 1,
                  )
                }
                aria-label="Previous match"
                className="rounded p-0.5 text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]"
              >
                <ChevronDown className="size-3 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveSearchIndex((prev) => (prev + 1) % matchingCount)
                }
                aria-label="Next match"
                className="rounded p-0.5 text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]"
              >
                <ChevronDown className="size-3" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSearchOpen(false)
            }}
            aria-label="Close search"
            className="rounded-full p-0.5 text-[var(--cx-text-4)] hover:text-[var(--cx-text-1)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search thread messages"
          title="Search thread"
          className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:border-[var(--cx-border-2)] hover:text-[var(--cx-text-1)]"
        >
          <Search className="size-4" />
        </button>
      )}
    </>
  )

  const body = isLoading ? (
    <MessageSkeletonRows />
  ) : error ? (
    <ErrorState onRetry={() => void refetch()} />
  ) : (
    <>
      {hasEarlier ? (
        <div className="flex justify-center py-3">
          <button
            type="button"
            onClick={() => void handleLoadEarlier()}
            disabled={loadingEarlier}
            className="flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-1 text-[11px] font-medium text-[var(--cx-text-3)] transition hover:border-[var(--cx-border-2)] hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingEarlier ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : null}
            {loadingEarlier ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>
        </div>
      ) : null}

      {chatMessageCount === 0 && !isPeerTyping ? (
        <p className="py-10 text-center text-sm text-[var(--cx-text-3)]">
          No messages yet. Say hello to start the conversation.
        </p>
      ) : (
        <MessageList
          messages={chatMessageGroups}
          groupLabels={groupLabels}
          isPeerTyping={isPeerTyping}
          peerName={peer?.fullName}
          endRef={bottomRef}
          onToggleReaction={handleToggleReaction}
          onRetryMessage={handleRetryMessage}
          onNearBottomChange={setNearBottom}
          searchQuery={searchQuery.trim() || undefined}
          activeMessageId={activeMatchId ?? undefined}
          newMessagesCount={newMessagesSinceScroll}
          onScrollToBottom={handleScrollToBottom}
          className="min-h-0 flex-1"
        />
      )}

      {sendError ? (
        <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
          {sendError}
        </p>
      ) : null}

      <MessageComposer
        sending={sending}
        matchId={matchId}
        autoFocus
        peerName={peer?.fullName}
        onSend={handleSend}
        onError={setSendError}
        onDraftChange={handleDraftChange}
      />

      <RelationshipSuggestionsCard
        matchId={matchId}
        peerName={peer?.fullName ?? ''}
      />
    </>
  )

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <header className="border-b border-[var(--cx-border-1)] px-3 pb-2.5 pt-3 sm:px-4">
          <div className="flex items-center gap-3">
            {peer.fullName ? (
              <button
                type="button"
                onClick={() => void handleOpenPeerProfile()}
                title={
                  peer.fullName
                    ? `View ${peer.fullName}'s profile`
                    : undefined
                }
                className="shrink-0 rounded-full transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--cx-brand)]"
              >
                {peer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={peer.avatarUrl}
                    alt={peer.fullName}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--cx-brand-soft)] text-xs font-semibold text-[var(--cx-brand-strong)]">
                    {peer.fullName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              // L-04 — pulse circle while the peer profile is still resolving.
              <div
                aria-hidden="true"
                className="size-10 shrink-0 animate-pulse rounded-full bg-[var(--cx-surface-3)]"
              />
            )}
            <div className="min-w-0 flex-1 leading-tight">
              {peer.fullName ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {peer.fullName}
                    </p>
                    <span className="shrink-0 rounded-full border border-[var(--cx-border-2)] bg-[var(--cx-surface-2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--cx-text-3)]">
                      Direct
                    </span>
                  </div>
                  {peer.role ? (
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[var(--cx-text-3)]">
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-[var(--cx-success)]"
                      />
                      {peer.role}
                    </p>
                  ) : null}
                </>
              ) : (
                // L-04 — pulse text until the peer name resolves.
                <div
                  aria-hidden="true"
                  className="animate-pulse space-y-2 py-0.5"
                >
                  <div className="h-3.5 w-28 rounded bg-[var(--cx-surface-3)]" />
                  <div className="h-2.5 w-16 rounded bg-[var(--cx-surface-3)]" />
                </div>
              )}
            </div>
            {renderSearchBar()}
          </div>
        </header>
        {body}
        {profileUserId ? (
          <MemberProfileDialog
            open
            onOpenChange={(open) => {
              if (!open) setProfileUserId(null)
            }}
            userId={profileUserId}
            matchId={matchId}
            peerName={peer?.fullName ?? null}
            peerRole={peer?.role ?? null}
            peerAvatarUrl={peer?.avatarUrl ?? null}
          />
        ) : null}
      </div>
    )
  }

  return (
    <main className="cx-page-enter min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <header className="sticky top-0 z-20 border-b border-[var(--cx-border-1)] bg-[color:var(--cx-bg)/.94] backdrop-blur-xl">
        <div className="mx-auto flex h-[50px] max-w-[1180px] items-center justify-between px-2.5 sm:h-[68px] sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]">
              <Sparkles className="size-4" />
            </div>
            {peer?.fullName ? (
              <button
                type="button"
                onClick={() => void handleOpenPeerProfile()}
                title={`View ${peer.fullName}'s profile`}
                className="flex items-center gap-2 rounded-full p-1 transition hover:bg-[var(--cx-surface-2)] focus:outline-none focus:ring-2 focus:ring-[var(--cx-brand)]"
              >
                {peer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={peer.avatarUrl}
                    alt={peer.fullName}
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-[var(--cx-surface-3)] text-xs font-semibold text-[var(--cx-text-1)]">
                    {peer.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-[var(--cx-text-1)] hover:underline">
                    {peer.fullName}
                  </span>
                  {peer.role ? (
                    <span className="block text-[11px] text-[var(--cx-text-3)]">
                      {peer.role}
                    </span>
                  ) : null}
                </div>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">{renderSearchBar()}</div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-50px)] max-w-[760px] flex-col px-4 py-6 sm:min-h-[calc(100svh-68px)] sm:px-6 lg:px-8">
        {body}
      </div>

      {profileUserId ? (
        <MemberProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setProfileUserId(null)
          }}
          userId={profileUserId}
          matchId={matchId}
          peerName={peer?.fullName ?? null}
          peerRole={peer?.role ?? null}
          peerAvatarUrl={peer?.avatarUrl ?? null}
        />
      ) : null}
    </main>
  )
}