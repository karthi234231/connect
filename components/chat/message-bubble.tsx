'use client'

import { useState, type ReactNode } from 'react'
import {
  Check,
  CheckCheck,
  Clock,
  Code,
  Copy,
  ExternalLink,
  FileArchive,
  FileCode,
  FileText,
  Maximize2,
  Paperclip,
  Plus,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  MESSAGE_REACTIONS,
  QUICK_REACTIONS,
  type MessageReaction,
  type ReactionSummary,
} from '@/lib/chat/reactions'
import {
  getFileCategory,
  getFileExtensionLabel,
  parseMarkdownMessage,
} from '@/lib/chat/markdown'
import { MediaLightbox } from './media-lightbox'

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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function renderHighlightedText(
  text: string,
  searchQuery?: string,
): ReactNode {
  if (!searchQuery || !searchQuery.trim()) {
    return text
  }

  const query = searchQuery.trim()
  const escapedQuery = escapeRegExp(query)
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={index}
        className="rounded bg-amber-400/40 px-0.5 font-medium text-amber-950 dark:bg-amber-400/50 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function CodeBlockView({
  language,
  code,
  searchQuery,
}: {
  language: string
  code: string
  searchQuery?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is restricted
    }
  }

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left font-mono text-xs text-zinc-100 shadow-md">
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-medium text-zinc-400">
        <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">
          <Code className="size-3.5 text-amber-400" />
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code snippet"
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-100 selection:bg-amber-500/30">
        <code>{renderHighlightedText(code, searchQuery)}</code>
      </pre>
    </div>
  )
}

export interface MessageBubbleProps {
  id?: string
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
  reactions?: ReactionSummary[]
  onToggleReaction?: (emoji: MessageReaction) => void
  searchQuery?: string
  isActiveSearchMatch?: boolean
}

export function MessageBubble({
  id,
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
  searchQuery,
  isActiveSearchMatch = false,
}: MessageBubbleProps): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const segments = parseMarkdownMessage(text)

  const renderAttachment = () => {
    if (!attachmentUrl) return null
    const isImg = isImageAttachment(attachmentUrl)
    if (isImg) {
      return (
        <div className="mt-2 overflow-hidden rounded-xl">
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
        </div>
      )
    }

    const category = getFileCategory(attachmentName, attachmentUrl)
    const extLabel = getFileExtensionLabel(attachmentName, attachmentUrl)

    const CategoryIcon =
      category === 'code'
        ? FileCode
        : category === 'pdf' || category === 'document'
          ? FileText
          : category === 'archive'
            ? FileArchive
            : Paperclip

    return (
      <div className="mt-2.5">
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition-all',
            sent
              ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
              : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] text-[var(--cx-text-1)] hover:border-[var(--cx-border-2)] hover:bg-[var(--cx-surface-1)]',
          )}
        >
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-bold shadow-xs',
              sent
                ? 'bg-white/20 text-white'
                : 'bg-[var(--cx-surface-1)] text-[var(--cx-brand-strong)] border border-[var(--cx-border-1)]',
            )}
          >
            <CategoryIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-snug">
              {attachmentName ?? 'Attachment'}
            </p>
            <span
              className={cn(
                'inline-block text-[10px] font-mono font-medium opacity-80',
                sent ? 'text-white/80' : 'text-[var(--cx-text-3)]',
              )}
            >
              {extLabel} File
            </span>
          </div>
          <div className="shrink-0 p-1 opacity-70 group-hover:opacity-100">
            <ExternalLink className="size-3.5" />
          </div>
        </a>
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
            <div className="flex items-center pl-0.5">
              {MESSAGE_REACTIONS.filter(
                (emoji) =>
                  !QUICK_REACTIONS.includes(
                    emoji as (typeof QUICK_REACTIONS)[number],
                  ),
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

  const renderBubbleContent = () => (
    <div className="break-words text-sm leading-relaxed">
      {segments.map((segment, idx) => {
        if (segment.type === 'codeblock') {
          return (
            <CodeBlockView
              key={idx}
              language={segment.language}
              code={segment.code}
              searchQuery={searchQuery}
            />
          )
        }
        if (segment.type === 'inlinecode') {
          return (
            <code
              key={idx}
              className="mx-0.5 rounded border border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-[var(--cx-brand-strong)]"
            >
              {renderHighlightedText(segment.code, searchQuery)}
            </code>
          )
        }
        return (
          <span key={idx} className="whitespace-pre-wrap">
            {renderHighlightedText(segment.content, searchQuery)}
          </span>
        )
      })}
      {renderAttachment()}
    </div>
  )

  if (sent) {
    return (
      <div
        id={id ? `message-${id}` : undefined}
        className={cn(
          'ml-auto flex w-fit max-w-[82%] flex-col items-end gap-0.5 transition-all duration-200',
          isActiveSearchMatch && 'rounded-2xl ring-2 ring-[var(--cx-brand)] shadow-lg',
        )}
      >
        <div className="rounded-2xl rounded-tr-md bg-[var(--cx-brand)] px-3.5 py-2.5 text-sm text-white shadow-sm">
          {renderBubbleContent()}
          {time || status ? (
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[9px] text-white/70">
              {time ? <span>{time}</span> : null}
              {status ? (
                <span
                  title={STATUS_LABEL[status]}
                  className={cn(
                    'inline-flex items-center font-medium',
                    status === 'read' ? 'text-sky-200' : 'text-white/70',
                  )}
                >
                  <span className="sr-only">{STATUS_LABEL[status]}</span>
                  {status === 'read' ? (
                    <CheckCheck
                      className="size-3.5 text-sky-200"
                      aria-hidden="true"
                    />
                  ) : status === 'sent' ? (
                    <Check
                      className="size-3.5 text-white/70"
                      aria-hidden="true"
                    />
                  ) : (
                    <Clock
                      className="size-3 animate-spin text-white/70"
                      aria-hidden="true"
                    />
                  )}
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
    <div className="flex w-fit max-w-[min(82%,340px)] flex-col gap-0.5">
      {displayName && showSender ? (
        <p className="text-[10px] font-medium leading-tight text-[var(--cx-text-3)]">
          {displayName}
        </p>
      ) : null}
      <div className="w-fit rounded-2xl rounded-tl-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3.5 py-2.5 text-sm text-[var(--cx-text-2)] shadow-sm">
        {renderBubbleContent()}
        {time ? (
          <div className="mt-1 text-[9px] text-[var(--cx-text-4)]">{time}</div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div
      id={id ? `message-${id}` : undefined}
      className={cn(
        'flex w-fit max-w-full flex-col gap-0.5 transition-all duration-200',
        isActiveSearchMatch && 'rounded-2xl ring-2 ring-[var(--cx-brand)] shadow-lg',
      )}
    >
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