'use client'

import type { ReactNode } from 'react'
import { Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui'
import { cn } from '@/utils/cn'

export interface ChatThread {
  id: string
  name: string
  initials: string
  tone: string
  lastMessage: string
  time: string
  kind?: 'Direct' | 'Group'
  unread?: boolean
  memberCount?: number
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
  return (
    <nav aria-label="Conversations" className={className}>
      <ul className="flex flex-col gap-1">
        {threads.map((thread) => {
          const selected = thread.id === selectedId
          const isGroup = thread.kind === 'Group'
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
                <span className="relative shrink-0">
                  {isGroup ? (
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-2xl bg-[var(--cx-surface-3)] text-[var(--cx-brand-strong)] ring-1 ring-[var(--cx-border-2)]"
                    >
                      <Users className="size-5" />
                    </span>
                  ) : (
                    <Avatar
                      avatarClassName={cn('size-11', thread.tone)}
                      aria-hidden="true"
                    >
                      <AvatarFallback className="text-[10px] text-[#332d3d]">
                        {thread.initials}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {thread.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--cx-text-4)]">
                      {thread.time}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-xs text-[var(--cx-text-3)]">
                      {isGroup ? (
                        <Users className="size-3 shrink-0 text-[var(--cx-text-4)]" />
                      ) : null}
                      <span className="truncate">{thread.lastMessage}</span>
                    </span>
                    {thread.unread ? (
                      <span className="shrink-0">
                        <span className="sr-only">Unread</span>
                        <span
                          aria-hidden="true"
                          className="block size-2 rounded-full bg-[var(--cx-brand)]"
                        />
                      </span>
                    ) : null}
                  </div>
                  {isGroup && thread.memberCount ? (
                    <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-[var(--cx-text-4)]">
                      Group &middot; {thread.memberCount} members
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
