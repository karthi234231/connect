'use client'

/**
 * Single source of truth for the chat inbox list, owned by this file.
 *
 * DATA FLOW: two queries joined by `lib/chat/inbox-adapter.ts` —
 *   - `fetchThreadsPage` (key `keys.threads().join('/')`) supplies the
 *     conversations (last message, unread, id), one page at a time;
 *   - `fetchMatches` (key `keys.matches().join('/')`) enriches each
 *     conversation with its peer profile (`fullName`, `avatarUrl`, `role`,
 *     `matchReason`, `status`) and backfills the `otherUserId`.
 *
 * QUERY KEYS ARE SHARED ON PURPOSE: the chat page runs its own matches query
 * for the thread header, so this hook uses the EXACT same key string
 * (`keys.matches().join('/')`). Both consumers therefore share one cache
 * entry; the query client is the dedupe layer (the page-side duplicate is
 * removed in a later wave — never fork the key here).
 *
 * KNOWN ACCEPTED BEHAVIOR: a conversation whose match is missing from the
 * matches list still renders, backfilling `otherUserId` with `''` and
 * falling back to a `New match` display name. When the MATCHES query alone
 * fails, the threads still render with those fallback names (`error` stays
 * null and `enrichmentError` carries the matches failure so the panel can
 * degrade instead of collapsing the inbox).
 *
 * PAGINATION (I-03): the threads key caches only the summary list; page
 * metadata (`cursor`, `hasMore`) lives in local state here. `loadMore`
 * fetches the next server page with the stored cursor, dedupes + appends to
 * the cached list and re-sorts through `sortInboxThreads` (threads arrive
 * server-sorted, so append-then-sort keeps the UI order). Every refetch
 * (20s poll, `focus`, `chat:inbox-refresh`) re-reads page 1, which naturally
 * resets the cursor.
 *
 * REFRESH POLICY: a 20s poll (override via `refreshIntervalMs`), a `window`
 * `focus` listener, and the `chat:inbox-refresh` custom event (dispatched by
 * `thread-view.tsx` after a send or a mark-read). A shared in-flight guard
 * collapses overlapping refreshes so focus + poll + event firing in the same
 * tick never turns into duplicate server calls.
 *
 * RETURN CONTRACT (consumed by `thread-list-panel.tsx` and the chat page):
 *   - `threads`          — sorted `InboxThread[]`
 *   - `isLoading`        — true while EITHER query is still on its first load
 *   - `error`            — the THREADS query error only (null when only the
 *                          matches query failed / once a refetch succeeds)
 *   - `enrichmentError`  — the MATCHES query error only (threads fine); null
 *                          otherwise
 *   - `refetch`          — `Promise<void>`, resolves after both queries settle
 *   - `totalUnread`      — sum of unread across all threads
 *   - `hasMore`          — true when a further inbox page exists
 *   - `isLoadingMore`    — true while a `loadMore` page fetch is in flight
 *   - `loadMore`         — `Promise<void>`, appends the next page
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchMatches, type MatchesResult } from '@/client/api/matches'
import { fetchThreadsPage } from '@/client/api/chat'
import { queryClient, useQuery } from '@/client/query/client'
import { keys } from '@/client/query/keys'
import {
  buildInboxThreads,
  sortInboxThreads,
  totalUnread,
  type InboxConversationInput,
  type InboxPeerInput,
  type InboxThread,
} from '@/lib/chat/inbox-adapter'
import type { ChatThreadSummary } from '@/types/message'

const DEFAULT_REFRESH_INTERVAL_MS = 20_000
const INBOX_REFRESH_EVENT = 'chat:inbox-refresh'
const INBOX_PAGE_SIZE = 30

export interface UseChatInboxOptions {
  refreshIntervalMs?: number
  pageSize?: number
}

function toInboxConversationInput(
  thread: ChatThreadSummary,
  otherUserId: string,
): InboxConversationInput {
  return {
    matchId: thread.matchId,
    otherUserId,
    lastMessageAt: thread.lastMessageAt,
    lastMessageContent: thread.lastMessageContent,
    lastMessageSenderId: thread.lastMessageSenderId,
    unread: thread.unread,
  }
}

function peerUserIdByMatch(
  matches: MatchesResult | undefined,
): Map<string, string> {
  return new Map(
    (matches ?? []).map((match) => [match.matchId, match.otherUser.id]),
  )
}

function toInboxPeerInput(match: MatchesResult[number]): InboxPeerInput {
  return {
    matchId: match.matchId,
    userId: match.otherUser.id,
    fullName: match.otherUser.fullName,
    avatarUrl: match.otherUser.avatarUrl ?? null,
    role: match.otherUser.role ?? null,
    status: match.status,
    matchReason: match.matchReason ?? null,
  }
}

/**
 * Append a fetched page onto the loaded conversation list, deduped by matchId
 * so a page fetched twice (refresh vs append) can never duplicate a row.
 */
function mergeThreadPages(
  existing: ChatThreadSummary[],
  incoming: ChatThreadSummary[],
): ChatThreadSummary[] {
  const seen = new Set(existing.map((thread) => thread.matchId))
  const merged = [...existing]
  for (const thread of incoming) {
    if (seen.has(thread.matchId)) continue
    seen.add(thread.matchId)
    merged.push(thread)
  }
  return merged
}

export function useChatInbox(options?: UseChatInboxOptions): {
  threads: InboxThread[]
  isLoading: boolean
  error: unknown
  enrichmentError: unknown
  refetch: () => Promise<void>
  totalUnread: number
  hasMore: boolean
  isLoadingMore: boolean
  loadMore: () => Promise<void>
} {
  const intervalMs = options?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS
  const pageSize = options?.pageSize ?? INBOX_PAGE_SIZE
  const threadsKey = keys.threads().join('/')

  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // First-page fetcher: (re)reading page 1 resets the cursor, which is what a
  // poll/focus/event refresh wants — stale pages are dropped, latest first.
  const fetchFirstPage = useCallback(
    async (): Promise<ChatThreadSummary[]> => {
      const page = await fetchThreadsPage({ limit: pageSize })
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
      return page.conversations
    },
    [pageSize],
  )

  const threadsQuery = useQuery<ChatThreadSummary[]>(
    threadsKey,
    fetchFirstPage,
  )
  const matchesQuery = useQuery<MatchesResult>(
    keys.matches().join('/'),
    () => fetchMatches(),
  )

  const refreshRef = useRef<() => Promise<void>>(async () => undefined)
  const refreshingRef = useRef(false)
  useEffect(() => {
    refreshRef.current = async () => {
      // In-flight guard: the 20s poll, the window `focus` listener and the
      // `chat:inbox-refresh` event can all fire within the same tick; a
      // refresh already in flight makes the next trigger a no-op instead of
      // a duplicate round-trip (the 20s window still covers staleness).
      if (refreshingRef.current) return
      refreshingRef.current = true
      try {
        await Promise.all([threadsQuery.refetch(), matchesQuery.refetch()])
      } finally {
        refreshingRef.current = false
      }
    }
  }, [threadsQuery, matchesQuery])

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshRef.current()
    }, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleRefresh = () => {
      void refreshRef.current()
    }

    window.addEventListener('focus', handleRefresh)
    window.addEventListener(INBOX_REFRESH_EVENT, handleRefresh)
    return () => {
      window.removeEventListener('focus', handleRefresh)
      window.removeEventListener(INBOX_REFRESH_EVENT, handleRefresh)
    }
  }, [])

  /** Fetch the next page with the stored cursor and append it to the list. */
  const loadMore = useCallback(async (): Promise<void> => {
    if (cursor == null || !hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const page = await fetchThreadsPage({ limit: pageSize, cursor })
      const merged = mergeThreadPages(
        queryClient.get<ChatThreadSummary[]>(threadsKey) ?? [],
        page.conversations,
      )
      queryClient.set(threadsKey, merged)
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch {
      // Leave cursor/hasMore untouched so the page fetch can be retried.
    } finally {
      setIsLoadingMore(false)
    }
  }, [cursor, hasMore, isLoadingMore, pageSize, threadsKey])

  const threads = useMemo(() => {
    const peerIds = peerUserIdByMatch(matchesQuery.data)
    const conversations = (threadsQuery.data ?? []).map((thread) =>
      toInboxConversationInput(thread, peerIds.get(thread.matchId) ?? ''),
    )
    const peers = (matchesQuery.data ?? []).map(toInboxPeerInput)
    return sortInboxThreads(
      buildInboxThreads({ conversations, peers, now: new Date() }),
    )
  }, [threadsQuery.data, matchesQuery.data])

  const unread = useMemo(() => totalUnread(threads), [threads])

  return {
    threads,
    isLoading: threadsQuery.isLoading || matchesQuery.isLoading,
    // E-02: the inbox collapses only when the THREADS query fails; a
    // matches-only failure degrades to `New match` fallback names and is
    // surfaced separately via `enrichmentError`.
    error: threadsQuery.error,
    enrichmentError: matchesQuery.error,
    refetch: async () => {
      await Promise.all([threadsQuery.refetch(), matchesQuery.refetch()])
    },
    totalUnread: unread,
    hasMore,
    isLoadingMore,
    loadMore,
  }
}