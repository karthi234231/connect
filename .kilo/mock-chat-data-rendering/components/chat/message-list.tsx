'use client'

import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { cn } from '@/utils/cn'
import type {
  MessageReaction,
  ReactionSummary,
} from '@/lib/chat/reactions'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

export type ChatMessage = {
  id: string
  text: string
  sent?: boolean
  time?: string
  status?: 'sent' | 'read' | 'pending'
  senderInitials?: string
  senderTone?: string
  senderName?: string
  attachmentUrl?: string | null
  attachmentName?: string | null
  reactions?: ReactionSummary[]
  searchQuery?: string
  isActiveSearchMatch?: boolean
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
  isPeerTyping?: boolean
  peerTone?: string
  peerName?: string
  className?: string
  /** Highlight search matches inside messages */
  searchQuery?: string
  /** Active selected search match message ID */
  activeMessageId?: string
}

export function MessageList({
  messages,
  groupLabels,
  dateDivider,
  endRef,
  footer,
  onToggleReaction,
  isPeerTyping = false,
  peerTone,
  peerName,
  className,
  searchQuery,
  activeMessageId,
}: MessageListProps): ReactNode {
  const internalEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = (endRef && typeof endRef === 'object' && 'current' in endRef && endRef.current)
      ? endRef.current
      : internalEndRef.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isPeerTyping, endRef])

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
                const prev = all[index - 1]
                // In group threads each incoming message carries sender info;
                // label the first message of every consecutive run per sender.
                const startsSenderRun =
                  !message.sent &&
                  Boolean(message.senderInitials) &&
                  (!prev || prev.sent || prev.senderName !== message.senderName)
                return (
                  <MessageBubble
                    key={message.id}
                    id={message.id}
                    text={message.text}
                    time={message.time}
                    sent={message.sent}
                    status={message.status}
                    initials={message.senderInitials}
                    tone={message.senderTone}
                    displayName={message.senderName}
                    showSender={startsSenderRun}
                    attachmentUrl={message.attachmentUrl}
                    attachmentName={message.attachmentName}
                    reactions={message.reactions}
                    onToggleReaction={
                      onToggleReaction
                        ? (emoji) => onToggleReaction(message.id, emoji)
                        : undefined
                    }
                    searchQuery={searchQuery ?? message.searchQuery}
                    isActiveSearchMatch={
                      message.isActiveSearchMatch ||
                      (Boolean(activeMessageId) && activeMessageId === message.id)
                    }
                  />
                )
              })}
            </div>
          )
        })}
        {isPeerTyping ? (
          <TypingIndicator
            tone={peerTone}
            label={peerName ? `${peerName} is typing…` : 'Typing…'}
            className="mt-2"
          />
        ) : null}
        {footer ? <div className="flex">{footer}</div> : null}
        <div ref={endRef ?? internalEndRef} />
      </div>
    </div>
  )
}
