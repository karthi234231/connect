'use client'

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import type {
  MessageReaction,
  ReactionSummary,
} from '@/lib/chat/reactions'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'

const SKELETON_MESSAGES = [
  { sent: false, width: 'max-w-[48%]' },
  { sent: true, width: 'max-w-[42%]' },
  { sent: false, width: 'max-w-[60%]' },
  { sent: false, width: 'max-w-[38%]' },
  { sent: false, width: 'max-w-[52%]' },
] satisfies { sent: boolean; width: string }[]

/** Whether this incoming message starts a consecutive run from the same
 * sender — only that bubble carries the sender chip (WhatsApp style). */
function startsSenderRun(
  message: ChatMessage,
  index: number,
  all: ChatMessage[],
): boolean {
  if (message.sent || !message.senderInitials) return false
  const prev = all[index - 1]
  if (!prev || prev.sent) return true
  return (
    prev.senderInitials !== message.senderInitials ||
    prev.senderName !== message.senderName
  )
}

export type ChatMessage = {
  id: string
  text: string
  sent?: boolean
  time?: string
  status?: 'sent' | 'read' | 'pending' | 'failed'
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
  /** Called with a message id when the user retries a failed send. */
  onRetryMessage?: (id: string) => void
  /** Reports whether the scroll container is within ~120px of the bottom
   * (changes only, throttled with rAF). Plumbing for a scroll-to-bottom FAB. */
  onNearBottomChange?: (nearBottom: boolean) => void
  /** When true, renders skeleton loading bubbles instead of the real list. */
  loading?: boolean
  /** Number of messages waiting below the fold; drives the scroll-to-bottom
   * FAB which shows only while the container is NOT near the bottom. */
  newMessagesCount?: number
  /** Fired when the "new messages" FAB is clicked — scroll the list down. */
  onScrollToBottom?: () => void
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
  onRetryMessage,
  onNearBottomChange,
  loading = false,
  newMessagesCount,
  onScrollToBottom,
}: MessageListProps): ReactNode {
  const internalEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const onNearBottomChangeRef = useRef(onNearBottomChange)
  // Auto-scroll follows new messages ONLY while the user is at the bottom —
  // reading history must never be yanked down by a poll refetch.
  const nearBottomRef = useRef(true)
  // State mirror of nearBottomRef so the FAB can hide/show on scroll.
  const [nearBottom, setNearBottom] = useState(true)

  useEffect(() => {
    onNearBottomChangeRef.current = onNearBottomChange
  }, [onNearBottomChange])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const report = () => {
      const value = el.scrollHeight - el.scrollTop - el.clientHeight <= 120
      if (value !== nearBottomRef.current) {
        nearBottomRef.current = value
        setNearBottom(value)
        onNearBottomChangeRef.current?.(value)
      }
    }
    let rafId = 0
    const handleScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        report()
      })
    }
    report()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      el.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Stable revision: a new `messages` identity is produced on every parent
  // render, so scroll changes only when the list actually grows or ends on a
  // different message (swaps to `failed`, new read receipts, etc. do not move).
  const lastGroup = messages[messages.length - 1]
  const lastMessageId = lastGroup?.[lastGroup.length - 1]?.id ?? ''
  const revision = `${
    messages.reduce((count, group) => count + group.length, 0)
  }:${lastMessageId}`

  useEffect(() => {
    if (!nearBottomRef.current) return
    const el =
      endRef && typeof endRef === 'object' && 'current' in endRef && endRef.current
        ? endRef.current
        : internalEndRef.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [revision, isPeerTyping, endRef])

  return (
    <div
      role="log"
      aria-label="Messages"
      aria-live="polite"
      ref={scrollRef}
      className={cn(
        'relative overflow-y-auto overscroll-contain px-4 py-5',
        className,
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col space-y-3">
        {loading ? (
          <div className="flex flex-col gap-1.5">
            {SKELETON_MESSAGES.map((skeleton, index) => (
              <SkeletonMessage
                key={index}
                sent={skeleton.sent}
                width={skeleton.width}
              />
            ))}
          </div>
        ) : (
          <>
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
                    const firstIncoming = startsSenderRun(message, index, all)
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
                        showSender={firstIncoming}
                        onRetry={
                          message.status === 'failed' && onRetryMessage
                            ? () => onRetryMessage(message.id)
                            : undefined
                        }
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
                          (Boolean(activeMessageId) &&
                            activeMessageId === message.id)
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
          </>
        )}
      </div>
      {!loading && newMessagesCount != null && newMessagesCount > 0 ? (
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label={`Scroll to ${newMessagesCount} new message${
            newMessagesCount === 1 ? '' : 's'
          }`}
          className={cn(
            'absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] py-1.5 pl-2 pr-3 text-xs font-medium text-[var(--cx-text-1)] shadow-md transition-all duration-300 ease-out hover:bg-[var(--cx-surface-3)]',
            nearBottom
              ? 'pointer-events-none translate-y-3 opacity-0'
              : 'translate-y-0 opacity-100',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-[var(--cx-brand)] text-[10px] font-semibold text-white"
          >
            {newMessagesCount}
          </span>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

function SkeletonMessage({
  sent,
  width,
}: {
  sent: boolean
  width: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex flex-col gap-0.5 animate-pulse', sent && 'ml-auto', width)}
    >
      <div
        className={cn(
          'w-fit rounded-2xl px-4 py-3',
          sent
            ? 'rounded-tr-md bg-[var(--cx-brand)]'
            : 'rounded-tl-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]',
        )}
      >
        <div className="space-y-2">
          <div
            className={cn(
              'h-2.5 rounded-full',
              sent ? 'bg-white/50' : 'bg-[var(--cx-text-3)]',
            )}
          />
          <div
            className={cn(
              'h-2.5 w-2/3 rounded-full',
              sent ? 'bg-white/40' : 'bg-[var(--cx-text-3)]/70',
            )}
          />
        </div>
      </div>
    </div>
  )
}