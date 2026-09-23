'use client'

import { useState, type ReactNode } from 'react'
import { Paperclip, Plus, Maximize2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  MESSAGE_REACTIONS,
  QUICK_REACTIONS,
  type MessageReaction,
  type ReactionSummary,
} from '@/lib/chat/reactions'
import { MediaLightbox } from './media-lightbox'

const STATUS_GLYPH: Record<'sent' | 'read' | 'pending', string> = {
  sent: '\u2713',
  read: '\u2713\u2713',
  pending: '\u00b7\u00b7\u00b7',
}

const STATUS_LABEL: Record<'sent' | 'read' | 'pending', string> = {
  sent: 'Sent',
  read: 'Read',
  pending: 'Sending',
}

function isImageAttachment(url?: string | null): boolean {
  if (!url) return false
  if (url.startsWith('data:image/')) return true
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase()
  return (
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.svg')
  )
}

export interface MessageBubbleProps {
  text: string
  time?: string
  sent?: boolean
  status?: 'sent' | 'read' | 'pending'
  initials?: string
  tone?: string
  displayName?: string
  showSender?: boolean
  attachmentUrl?: string | null
  attachmentName?: string | null
  /**
   * Aggregated reaction chips rendered under the bubble. Omit to hide the
   * whole reaction affordance for this message.
   */
  reactions?: ReactionSummary[]
  /** Toggles a reaction for this message; makes chips interactive. */
  onToggleReaction?: (emoji: MessageReaction) => void
}

export function MessageBubble({
  text,
  time,
  sent = false,
  status,
  initials,
  tone,
  displayName,
  showSender = false,
  attachmentUrl,
  attachmentName,
  reactions,
  onToggleReaction,
}: MessageBubbleProps): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const renderAttachment = () => {
    if (!attachmentUrl) return null
    const isImg = isImageAttachment(attachmentUrl)
    return (
      <div className="mt-2 overflow-hidden rounded-xl">
        {isImg ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`Enlarge image ${attachmentName ?? 'attachment'}`}
              className="group relative block w-full overflow-hidden rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[var(--cx-brand)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachmentUrl}
                alt={attachmentName ?? 'Media attachment'}
                className="max-h-60 max-w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-xs">
                  <Maximize2 className="size-3.5" /> Enlarge
                </span>
              </div>
            </button>
            <MediaLightbox
              src={attachmentUrl}
              alt={attachmentName ?? 'Media attachment'}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </>
        ) : (
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
              sent
                ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] text-[var(--cx-text-1)] hover:bg-[var(--cx-surface-1)]',
            )}
          >
            <Paperclip className="size-3.5 shrink-0" />
            <span className="truncate">{attachmentName ?? 'View attachment'}</span>
          </a>
        )}
      </div>
    )
  }

  const reactionControls =
    reactions === undefined ? null : (
      <div
        className={cn(
          'flex flex-wrap items-center gap-1',
          sent ? 'justify-end' : 'justify-start',
        )}
      >
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onToggleReaction?.(reaction.emoji)}
            aria-pressed={reaction.reactedByViewer}
            aria-label={reaction.label}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
              reaction.reactedByViewer
                ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-3)]',
            )}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        ))}
        {onToggleReaction && pickerOpen ? (
          <div
            role="group"
            aria-label="Reaction quick-picker"
            className="flex items-center gap-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-1 shadow-md animate-in fade-in duration-150"
          >
            {/* Quick Picker Reactions: ❤️, 👍, 🚀, 💡 */}
            <div className="flex items-center border-r border-[var(--cx-border-1)] pr-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(emoji)
                    setPickerOpen(false)
                  }}
                  aria-label={`React with ${emoji}`}
                  className="rounded-full px-1.5 py-0.5 text-base transition hover:scale-125 hover:bg-[var(--cx-surface-3)]"
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
            {/* Extended Reactions */}
            <div className="flex items-center pl-0.5">
              {MESSAGE_REACTIONS.filter(
                (emoji) => !QUICK_REACTIONS.includes(emoji as (typeof QUICK_REACTIONS)[number]),
              ).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(emoji)
                    setPickerOpen(false)
                  }}
                  aria-label={`React with ${emoji}`}
                  className="rounded-full px-1 text-sm opacity-80 transition hover:opacity-100 hover:bg-[var(--cx-surface-3)]"
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {onToggleReaction ? (
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Add reaction"
            aria-expanded={pickerOpen}
            className="flex size-5 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
          >
            <Plus className="size-3" />
          </button>
        ) : null}
      </div>
    )

  if (sent) {
    return (
      <div className="ml-auto flex w-fit max-w-[82%] flex-col items-end gap-0.5">
        <div className="rounded-2xl rounded-tr-md bg-[var(--cx-brand)] px-3.5 py-2.5 text-sm text-white shadow-sm">
          <p className="break-words whitespace-pre-wrap">{text}</p>
          {renderAttachment()}
          {time || status ? (
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[9px] text-white/70">
              {time ? <span>{time}</span> : null}
              {status ? (
                <span
                  title={STATUS_LABEL[status]}
                  className={cn(
                    'inline-flex items-center font-medium tracking-tighter',
                    status === 'read' ? 'text-sky-200 font-bold' : 'text-white/70',
                  )}
                >
                  <span className="sr-only">{STATUS_LABEL[status]}</span>
                  <span aria-hidden="true">{STATUS_GLYPH[status]}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {reactionControls}
      </div>
    )
  }

  const bubble = (
    <div className="flex w-fit max-w-[min(82%,280px)] flex-col gap-0.5">
      {displayName && showSender ? (
        <p className="text-[10px] font-medium leading-tight text-[var(--cx-text-3)]">
          {displayName}
        </p>
      ) : null}
      <div className="w-fit rounded-2xl rounded-tl-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3.5 py-2.5 text-sm text-[var(--cx-text-2)] shadow-sm">
        <p className="break-words whitespace-pre-wrap">{text}</p>
        {renderAttachment()}
        {time ? (
          <div className="mt-1 text-[9px] text-[var(--cx-text-4)]">{time}</div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="flex w-fit max-w-full flex-col gap-0.5">
      <div className={cn('flex w-fit max-w-full items-end gap-2')}>
        {showSender && initials ? (
          <div
            aria-hidden="true"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#332d3d]',
              tone,
            )}
          >
            {initials}
          </div>
        ) : null}
        {bubble}
      </div>
      {reactionControls}
    </div>
  )
}