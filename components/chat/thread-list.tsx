'use client'

import type { ReactNode } from 'react'
import { Users } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ChatThread {
  id: string
  name: string
  initials: string
  tone: string
  avatarUrl?: string | null
  lastMessage: string
  time: string
  kind?: 'Direct' | 'Group'
  unread?: boolean
  unreadCount?: number
  memberCount?: number
  matchReason?: string | null
  hasMessages?: boolean
}

export interface ThreadListProps {
  threads: ChatThread[]
  selectedId?: string
  onSelect?: (id: string) => void
  className?: string
}

export function ThreadList({
  threads,
  selectedId,
  onSelect,
  className,
}: ThreadListProps): ReactNode {
  if (threads.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-[var(--cx-text-3)]">
        No conversations yet.
      </p>
    )
  }

  return (
    <nav aria-label="Conversations" className={className}>
      <ul className="flex flex-col gap-1">
        {threads.map((thread) => {
          const selected = thread.id === selectedId
          const isGroup = thread.kind === 'Group'
          const unreadCount = thread.unreadCount ?? 0
          const hasMessages =
            thread.hasMessages ?? thread.lastMessage.trim().length > 0
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onSelect?.(thread.id)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                  selected
                    ? 'bg-[var(--cx-brand-soft)]'
                    : 'hover:bg-[var(--cx-surface-2)]',
                )}
              >
                <span className="shrink-0">
                  {thread.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thread.avatarUrl}
                      alt=""
                      className="size-11 rounded-full object-cover"
                    />
                  ) : isGroup ? (
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-2xl bg-[var(--cx-surface-3)] text-[var(--cx-brand-strong)] ring-1 ring-[var(--cx-border-2)]"
                    >
                      <Users className="size-5" />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-11 items-center justify-center rounded-full text-[11px] font-semibold text-[#332d3d]',
                        thread.tone,
                      )}
                    >
                      {thread.initials}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {thread.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--cx-text-3)]">
                      {thread.time}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-[var(--cx-text-3)]">
                      {hasMessages
                        ? thread.lastMessage
                        : 'Say hello'}
                    </span>
                    {unreadCount > 0 ? (
                      <span className="shrink-0">
                        <span className="sr-only">
                          {unreadCount} unread
                        </span>
                        <span
                          aria-hidden="true"
                          className="block rounded-full bg-[var(--cx-brand)] px-1.5 py-px text-xs font-bold text-white"
                        >
                          {unreadCount}
                        </span>
                      </span>
                    ) : thread.unread ? (
                      <span className="shrink-0">
                        <span className="sr-only">Unread</span>
                        <span
                          aria-hidden="true"
                          className="block size-2 rounded-full bg-[var(--cx-brand)]"
                        />
                      </span>
                    ) : null}
                  </span>
                  {thread.matchReason ? (
                    <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--cx-brand-strong)]">
                      {thread.matchReason}
                    </span>
                  ) : null}
                  {isGroup && thread.memberCount ? (
                    <span className="mt-0.5 block text-[11px] text-[var(--cx-text-3)]">
                      Group · {thread.memberCount} members
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
