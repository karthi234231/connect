'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  filterInboxThreads,
  type InboxFilter,
  type InboxThread,
} from '@/lib/chat/inbox-adapter'
import { ThreadList, type ChatThread } from '@/components/chat'
import { ErrorState } from '@/components/states/ErrorState'

const FILTER_OPTIONS: InboxFilter[] = ['all', 'unread', 'new']

const FILTER_LABELS: Record<InboxFilter, string> = {
  all: 'All',
  unread: 'Unread',
  new: 'New',
}

export function ThreadListPanel({
  activeMatchId,
  onSelectMatch,
  threads,
  isLoading,
  error,
  refetch,
  viewerId,
  loadMore,
  hasMore,
  isLoadingMore,
}: {
  activeMatchId: string | null
  onSelectMatch?: (matchId: string) => void
  threads: InboxThread[]
  isLoading: boolean
  error: unknown
  refetch: () => Promise<void>
  viewerId?: string | null
  loadMore?: () => Promise<void>
  hasMore?: boolean
  isLoadingMore?: boolean
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [search, setSearch] = useState('')

  function handleSelect(id: string) {
    if (onSelectMatch) {
      onSelectMatch(id)
    } else {
      router.push(`/dashboard/chat/${encodeURIComponent(id)}`)
    }
  }

  function clearSearchAndFilters() {
    setSearch('')
    setFilter('all')
  }

  const query = search.trim()

  const visible = useMemo(() => {
    const byFilter = filterInboxThreads(threads, filter)
    const normalized = query.toLowerCase()
    if (!normalized) return byFilter
    return byFilter.filter(
      (thread) =>
        thread.name.toLowerCase().includes(normalized) ||
        thread.lastMessage.toLowerCase().includes(normalized),
    )
  }, [threads, filter, query])

  const chatThreads: ChatThread[] = visible.map((thread) => ({
    id: thread.id,
    name: thread.name,
    initials: thread.initials,
    tone: thread.tone,
    avatarUrl: thread.avatarUrl,
    // I-04: prefix the preview with "You: " when the viewer authored the
    // latest message. The adapter contract stays unchanged — the display tweak
    // lives in the panel only, and empty/attachment-only previews are skipped.
    lastMessage:
      viewerId != null &&
      thread.lastMessageSenderId != null &&
      thread.lastMessageSenderId === viewerId &&
      thread.lastMessage.length > 0
        ? `You: ${thread.lastMessage}`
        : thread.lastMessage,
    time: thread.timeLabel,
    kind: 'Direct',
    unread: thread.unreadCount > 0,
    unreadCount: thread.unreadCount,
    matchReason: thread.matchReason,
    hasMessages: thread.hasMessages,
  }))

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={active}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition',
                active
                  ? 'bg-[var(--cx-brand)] text-white shadow-[0_4px_12px_rgba(207,159,82,.28)]'
                  : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-3)]',
              )}
            >
              {FILTER_LABELS[option]}
            </button>
          )
        })}
      </div>

      <div className="mb-3 px-1">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--cx-text-4)]"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-full rounded-full bg-[var(--cx-surface-2)] py-2 pl-9 pr-3 text-xs text-[var(--cx-text-1)] outline-none transition placeholder:text-[var(--cx-text-4)] focus:outline-none focus:ring-2 focus:ring-[var(--cx-brand)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <ul
            className="flex animate-pulse flex-col gap-1"
            aria-label="Loading conversations"
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-2xl p-2.5"
              >
                <span className="size-11 shrink-0 rounded-full bg-[var(--cx-surface-3)]" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3.5 w-1/3 rounded bg-[var(--cx-surface-3)]" />
                  <span className="block h-3 w-2/3 rounded bg-[var(--cx-surface-3)]" />
                </span>
              </li>
            ))}
          </ul>
        ) : error ? (
          // E-03: mirror the thread-view retry affordance instead of the tiny
          // text link — a real threads failure still gets a visible error wall.
          <ErrorState
            title="Couldn&apos;t load conversations"
            description="We hit a snag loading your chats. Please try again in a moment."
            onRetry={() => void refetch()}
          />
        ) : threads.length === 0 ? (
          <div
            role="region"
            aria-label="Conversations"
            className="flex flex-col items-center justify-center px-3 py-10 text-center"
          >
            <p className="text-sm font-medium text-[var(--cx-text-2)]">
              No messages yet
            </p>
            <p className="mt-1 text-xs text-[var(--cx-text-3)]">
              New matches will appear here
            </p>
          </div>
        ) : visible.length === 0 ? (
          // E-01: threads exist but the search/filter without results — show a
          // clearable empty state rather than the generic list empty copy.
          <div
            role="region"
            aria-label="No matching conversations"
            className="flex flex-col items-center justify-center px-3 py-10 text-center"
          >
            <p className="text-sm font-medium text-[var(--cx-text-2)]">
              {query
                ? `No results for “${query}”`
                : 'No conversations match this filter'}
            </p>
            <button
              type="button"
              onClick={clearSearchAndFilters}
              className="mt-3 rounded-full bg-[var(--cx-surface-2)] px-4 py-1.5 text-xs font-medium text-[var(--cx-text-2)] ring-1 ring-[var(--cx-border-1)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
            >
              {query ? 'Clear search' : 'Clear search & filters'}
            </button>
          </div>
        ) : (
          <>
            <ThreadList
              threads={chatThreads}
              selectedId={activeMatchId ?? undefined}
              onSelect={handleSelect}
              className="px-1"
            />
            {hasMore ? (
              <div className="mt-2 flex justify-center px-1">
                <button
                  type="button"
                  onClick={() => void loadMore?.()}
                  disabled={isLoadingMore || typeof loadMore === 'undefined'}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--cx-surface-2)] px-4 py-2 text-xs font-medium text-[var(--cx-text-2)] ring-1 ring-[var(--cx-border-1)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoadingMore ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3.5 animate-spin"
                    />
                  ) : null}
                  {isLoadingMore ? 'Loading…' : 'Load more conversations'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}