'use client'

import type { ReactNode } from 'react'
import { Avatar, AvatarFallback, Badge } from '@/components/ui'
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
          return (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onSelect?.(thread.id)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition',
                  selected
                    ? 'bg-[var(--cx-brand-soft)]'
                    : 'hover:bg-[var(--cx-surface-2)]',
                )}
              >
                <Avatar
                  avatarClassName={cn('size-11', thread.tone)}
                  aria-hidden="true"
                >
                  <AvatarFallback className="text-[10px] text-[#332d3d]">
                    {thread.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {thread.name}
                      </span>
                      {thread.kind ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1.5 py-0.5 text-[9px]"
                        >
                          {thread.kind === 'Group' && thread.memberCount
                            ? `${thread.kind} \u00b7 ${thread.memberCount}`
                            : thread.kind}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--cx-text-4)]">
                      {thread.time}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-[var(--cx-text-3)]">
                      {thread.lastMessage}
                    </span>
                    {thread.unread ? (
                      <span className="shrink-0">
                        <span className="sr-only">Unread</span>
                        <span
                          aria-hidden="true"
                          className="block size-1.5 rounded-full bg-[var(--cx-brand)]"
                        />
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
