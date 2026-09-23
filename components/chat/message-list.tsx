'use client'

import type { ReactNode, Ref } from 'react'
import { cn } from '@/utils/cn'
import type {
  MessageReaction,
  ReactionSummary,
} from '@/lib/chat/reactions'
import { MessageBubble } from './message-bubble'

export type ChatMessage = {
  id: string
  text: string
  sent?: boolean
  time?: string
  status?: 'sent' | 'read' | 'pending'
  senderInitials?: string
  senderTone?: string
  senderName?: string
  reactions?: ReactionSummary[]
}

export interface MessageListProps {
  messages: ChatMessage[][]
  /** Optional divider chip label rendered above each group (by index). */
  groupLabels?: (string | undefined)[]
  /** Kept for back-compat: a single divider chip rendered above the list. */
  dateDivider?: string
  /** Attached at the very end of the list; scroll this into view to follow new messages. */
  endRef?: Ref<HTMLDivElement>
  /** Rendered just before the end sentinel (typography tail, etc.). */
  footer?: ReactNode
  onToggleReaction?: (messageId: string, emoji: MessageReaction) => void
  className?: string
}

export function MessageList({
  messages,
  groupLabels,
  dateDivider,
  endRef,
  footer,
  onToggleReaction,
  className,
}: MessageListProps): ReactNode {
  return (
    <div
      role="log"
      aria-label="Messages"
      aria-live="polite"
      className={cn(
        'overflow-y-auto overscroll-contain px-4 py-5',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col space-y-3">
        {dateDivider ? (
          <div className="flex justify-center py-1">
            <span className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-3)]">
              {dateDivider}
            </span>
          </div>
        ) : null}
        {messages.map((group, groupIndex) => {
          const label = groupLabels?.[groupIndex]
          return (
            <div key={groupIndex} className="flex flex-col gap-1.5">
              {label ? (
                <div className="flex justify-center py-1">
                  <span className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-3)]">
                    {label}
                  </span>
                </div>
              ) : null}
              {group.map((message, index, all) => {
                const lastIncoming = !message.sent && index === all.length - 1
                return (
                  <MessageBubble
                    key={message.id}
                    text={message.text}
                    time={message.time}
                    sent={message.sent}
                    status={message.status}
                    initials={message.senderInitials}
                    tone={message.senderTone}
                    displayName={message.senderName}
                    showSender={Boolean(message.senderInitials && lastIncoming)}
                    reactions={message.reactions}
                    onToggleReaction={
                      onToggleReaction
                        ? (emoji) => onToggleReaction(message.id, emoji)
                        : undefined
                    }
                  />
                )
              })}
            </div>
          )
        })}
        {footer ? <div className="flex">{footer}</div> : null}
        <div ref={endRef} />
      </div>
    </div>
  )
}