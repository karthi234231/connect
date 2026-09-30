'use client'

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Code,
  Copy,
  ExternalLink,
  FileArchive,
  FileCode,
  FileText,
  FileX,
  ImageOff,
  Loader2,
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
  linkifyMessageText,
  parseMarkdownMessage,
} from '@/lib/chat/markdown'
import { isImageAttachmentUrl } from '@/lib/chat/attachment'
import {
  getSignedAttachmentUrl,
  useAttachmentSignedUrl,
} from '@/hooks/use-attachment-urls'
import { MediaLightbox } from './media-lightbox'

const STATUS_LABEL: Record<'sent' | 'read' | 'pending' | 'failed', string> = {
  sent: 'Sent',
  read: 'Read',
  pending: 'Sending',
  failed: 'Not delivered',
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
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
  status?: 'sent' | 'read' | 'pending' | 'failed'
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
  onRetry?: () => void
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
  onRetry,
}: MessageBubbleProps): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeReactionIndex, setActiveReactionIndex] = useState(0)
  const reactionBarRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const {
    url: resolvedAttachmentUrl,
    isLoading: isAttachmentLoading,
    error: attachmentError,
  } = useAttachmentSignedUrl(attachmentUrl)

  const [attachmentRetry, setAttachmentRetry] = useState<{
    path: string | null
    attempt: number
    loading: boolean
    url: string | null
    failed: boolean
  }>({ path: null, attempt: 0, loading: false, url: null, failed: false })

  const retried =
    attachmentRetry.path === attachmentUrl && attachmentRetry.attempt > 0
  const signedAttachmentUrl = retried
    ? attachmentRetry.url
    : resolvedAttachmentUrl
  const attachmentFailed = retried
    ? attachmentRetry.failed
    : attachmentError !== null
  const attachmentResolving =
    attachmentRetry.loading ||
    (isAttachmentLoading && !retried) ||
    (signedAttachmentUrl === null && !attachmentFailed)

  const handleRetryAttachment = () => {
    if (!attachmentUrl) return
    setAttachmentRetry((prev) => ({
      path: attachmentUrl ?? null,
      attempt: prev.attempt + 1,
      loading: true,
      url: null,
      failed: false,
    }))
    void getSignedAttachmentUrl(attachmentUrl)
      .then((url) => {
        setAttachmentRetry((prev) => ({
          ...prev,
          loading: false,
          url: url || null,
          failed: !url,
        }))
      })
      .catch(() => {
        setAttachmentRetry((prev) => ({
          ...prev,
          loading: false,
          url: null,
          failed: true,
        }))
      })
  }

  useEffect(() => {
    if (!pickerOpen) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!reactionBarRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    pickerRef.current
      ?.querySelector<HTMLButtonElement>('[data-emoji-option]')
      ?.focus()

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pickerOpen])

  const handlePickerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const navigableKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]
    if (!navigableKeys.includes(event.key)) return
    event.preventDefault()
    const options = Array.from(
      pickerRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-emoji-option]',
      ) ?? [],
    )
    if (options.length === 0) return
    const currentIndex = options.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    let nextIndex: number
    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    } else {
      const direction =
        event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      nextIndex =
        currentIndex === -1
          ? direction === 1
            ? 0
            : options.length - 1
          : (currentIndex + direction + options.length) % options.length
    }
    options[nextIndex].focus()
  }

  const segments = parseMarkdownMessage(text)

  const renderAttachment = () => {
    if (!attachmentUrl) return null
    const isImg = isImageAttachmentUrl(attachmentUrl)
    const label = attachmentName ?? 'Media attachment'
    if (isImg) {
      if (attachmentFailed) {
        return (
          <div
            className={cn(
              'mt-2 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs',
              sent
                ? 'border-red-400/40 bg-red-500/10 text-red-100'
                : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] text-[var(--cx-text-3)]',
            )}
          >
            <ImageOff className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Can't load attachment</span>
            <button
              type="button"
              onClick={handleRetryAttachment}
              aria-label="Retry loading attachment"
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2',
                sent
                  ? 'border-red-300/50 text-red-100 hover:bg-red-500/20 focus-visible:ring-red-300'
                  : 'border-[var(--cx-border-2)] text-[var(--cx-text-1)] hover:bg-[var(--cx-surface-1)] focus-visible:ring-[var(--cx-brand)]',
              )}
            >
              Retry
            </button>
          </div>
        )
      }
      if (attachmentResolving || signedAttachmentUrl === null) {
        return (
          <div className="mt-2 flex h-44 w-full max-w-full items-center justify-center rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-3)]">
            <Loader2
              className="size-5 animate-spin text-[var(--cx-text-3)]"
              aria-hidden="true"
            />
          </div>
        )
      }
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
              src={signedAttachmentUrl}
              alt={label}
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
            src={signedAttachmentUrl}
            alt={label}
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

    if (attachmentFailed) {
      return (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-2.5 rounded-xl border p-2.5 text-xs',
            sent
              ? 'border-red-400/40 bg-red-500/10 text-red-100'
              : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] text-[var(--cx-text-3)]',
          )}
        >
          <FileX className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">Can't load attachment</span>
          <button
            type="button"
            onClick={handleRetryAttachment}
            aria-label="Retry loading attachment"
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2',
              sent
                ? 'border-red-300/50 text-red-100 hover:bg-red-500/20 focus-visible:ring-red-300'
                : 'border-[var(--cx-border-2)] text-[var(--cx-text-1)] hover:bg-[var(--cx-surface-1)] focus-visible:ring-[var(--cx-brand)]',
            )}
          >
            Retry
          </button>
        </div>
      )
    }

    if (attachmentResolving || signedAttachmentUrl === null) {
      return (
        <div
          className={cn(
            'mt-2.5 flex items-center gap-2.5 rounded-xl border p-2.5 text-xs',
            sent
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-3)] text-[var(--cx-text-1)]',
          )}
        >
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold shadow-xs',
              sent
                ? 'bg-white/20 text-white'
                : 'bg-[var(--cx-surface-1)] text-[var(--cx-brand-strong)] border border-[var(--cx-border-1)]',
            )}
          >
            <CategoryIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-snug">
              {attachmentName ?? 'Attachment'}
            </p>
          </div>
          <Loader2
            className="size-3.5 shrink-0 animate-spin opacity-70"
            aria-hidden="true"
          />
        </div>
      )
    }

    return (
      <div className="mt-2.5">
        <a
          href={signedAttachmentUrl}
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
              'flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold shadow-xs',
              sent
                ? 'bg-white/20 text-white'
                : 'bg-[var(--cx-surface-1)] text-[var(--cx-brand-strong)] border border-[var(--cx-border-1)]',
            )}
          >
            <CategoryIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-snug">
              {attachmentName ?? 'Attachment'}
            </p>
            <span
              className={cn(
                'inline-block text-[11px] font-mono font-medium opacity-80',
                sent ? 'text-white/80' : 'text-[var(--cx-text-3)]',
              )}
            >
              {extLabel} File
            </span>
          </div>
          <div className="shrink-0 p-1 opacity-70 group-hover:opacity-100">
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </div>
        </a>
      </div>
    )
  }

  const extraPickerReactions: MessageReaction[] = MESSAGE_REACTIONS.filter(
    (emoji) =>
      !QUICK_REACTIONS.includes(emoji as (typeof QUICK_REACTIONS)[number]),
  )

  const reactionControls =
    reactions === undefined ? null : (
      <div
        ref={reactionBarRef}
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
            ref={pickerRef}
            role="group"
            aria-label="Reaction quick-picker"
            onKeyDown={handlePickerKeyDown}
            className="flex items-center gap-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-1 shadow-md animate-in fade-in duration-150"
          >
            <div className="flex items-center border-r border-[var(--cx-border-1)] pr-1">
              {QUICK_REACTIONS.map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  tabIndex={activeReactionIndex === index ? 0 : -1}
                  onFocus={() => setActiveReactionIndex(index)}
                  data-emoji-option
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
              {extraPickerReactions.map((emoji, offset) => {
                const index = QUICK_REACTIONS.length + offset
                return (
                  <button
                    key={emoji}
                    type="button"
                    tabIndex={activeReactionIndex === index ? 0 : -1}
                    onFocus={() => setActiveReactionIndex(index)}
                    data-emoji-option
                    onClick={() => {
                      onToggleReaction(emoji)
                      setPickerOpen(false)
                    }}
                    aria-label={`React with ${emoji}`}
                    className="rounded-full px-1 text-sm opacity-80 transition hover:opacity-100 hover:bg-[var(--cx-surface-3)]"
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        {onToggleReaction ? (
          <button
            ref={triggerRef}
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
            {linkifyMessageText(segment.content).map((part, partIdx) =>
              part.type === 'link' ? (
                <a
                  key={partIdx}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'font-medium underline underline-offset-2 transition-colors',
                    sent
                      ? 'text-white decoration-white/60 hover:decoration-white'
                      : 'text-[var(--cx-brand-strong)] decoration-[var(--cx-brand-strong)]/40 hover:decoration-[var(--cx-brand-strong)]',
                  )}
                >
                  {renderHighlightedText(part.text, searchQuery)}
                </a>
              ) : (
                <span key={partIdx}>
                  {renderHighlightedText(part.content, searchQuery)}
                </span>
              ),
            )}
          </span>
        )
      })}
      {renderAttachment()}
    </div>
  )

  if (sent) {
    const failed = status === 'failed'
    return (
      <div
        id={id ? `message-${id}` : undefined}
        className={cn(
          'ml-auto flex w-fit max-w-[82%] flex-col items-end gap-0.5 transition-all duration-200',
          isActiveSearchMatch && 'rounded-2xl ring-2 ring-[var(--cx-brand)] shadow-lg',
        )}
      >
        <div className="flex items-center gap-1.5">
          {failed ? (
            <button
              type="button"
              onClick={onRetry}
              title="Not delivered — tap to retry"
              aria-label="Not delivered — tap to retry"
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-red-300 transition hover:bg-red-500/10 hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <AlertCircle className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <div className="rounded-2xl rounded-tr-md bg-[var(--cx-brand)] px-3.5 py-2.5 text-sm text-white shadow-sm">
            {renderBubbleContent()}
            {time || status ? (
              <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-white/70">
                {time ? <span>{time}</span> : null}
                {status ? (
                  <span
                    title={STATUS_LABEL[status]}
                    className={cn(
                      'inline-flex items-center font-medium',
                      status === 'read'
                        ? 'text-sky-200'
                        : status === 'failed'
                          ? 'text-red-300'
                          : 'text-white/70',
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
                    ) : status === 'pending' ? (
                      <Clock
                        className="size-3 text-white/70"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="size-3.5 text-red-300"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {reactionControls}
      </div>
    )
  }

  const bubble = (
    <div className="flex w-fit max-w-[min(82%,340px)] flex-col gap-0.5">
      {displayName && showSender ? (
        <p className="text-[11px] font-medium leading-tight text-[var(--cx-text-3)]">
          {displayName}
        </p>
      ) : null}
      <div className="w-fit rounded-2xl rounded-tl-md border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3.5 py-2.5 text-sm text-[var(--cx-text-2)] shadow-sm">
        {renderBubbleContent()}
        {time ? (
          <div className="mt-1 text-[11px] text-[var(--cx-text-3)]">{time}</div>
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
              'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#332d3d]',
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