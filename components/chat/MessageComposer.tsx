'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  ALLOWED_ATTACHMENT_MIME,
  validateAttachmentFile,
} from '@/lib/chat/attachment'
import {
  canSubmitDraft,
  cleanComposerText,
  COMPOSER_MAX_CHARS,
} from '@/lib/chat/composer-input'
import {
  createChatAttachmentUpload,
  uploadChatAttachment,
} from '@/client/api/chat'

export type ComposerConnectionState = 'connecting' | 'reconnecting' | 'online'

export interface ComposerSendDraft {
  text: string
  attachmentUrl?: string
  attachmentName?: string
}

interface MessageComposerProps {
  /**
   * `pill` keeps the legacy connection-status badge (headers, default so
   * existing callers are untouched); `composer` renders the real message
   * input with send-on-enter + attachments.
   */
  variant?: 'pill' | 'composer'
  connectionState?: ComposerConnectionState
  className?: string
  /** Composer mode only — offline/locked threads disable the input. */
  disabled?: boolean
  /** Composer mode only — an in-flight send disables the affordance. */
  sending?: boolean
  placeholder?: string
  autoFocus?: boolean
  /** Required for the attachment upload flow (createAttachmentUpload). */
  matchId?: string
  onSend?: (draft: ComposerSendDraft) => void | Promise<void>
  onError?: (message: string) => void
  /** Composer mode only — fired with the raw draft on every keystroke. */
  onDraftChange?: (text: string) => void
}

const STATUS_LABEL: Record<ComposerConnectionState, string> = {
  online: 'Online',
  reconnecting: 'Reconnecting\u2026',
  connecting: 'Connecting\u2026',
}

const STATUS_DOT: Record<ComposerConnectionState, string> = {
  online: 'bg-[var(--cx-success)]',
  reconnecting: 'bg-[var(--cx-warning)]',
  connecting: 'bg-[var(--cx-text-4)]',
}

export function MessageComposer({
  variant = 'pill',
  connectionState = 'connecting',
  className,
  disabled = false,
  sending = false,
  placeholder,
  autoFocus = false,
  matchId,
  onSend,
  onError,
  onDraftChange,
}: MessageComposerProps): ReactNode {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<{
    url: string
    name: string
  } | null>(null)
  const [attaching, setAttaching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (variant !== 'composer') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2.5 py-1 ${className ?? ''}`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[connectionState]}`}
        />
        <span className="text-[10px] font-medium tracking-wide text-[var(--cx-text-3)]">
          {STATUS_LABEL[connectionState]}
        </span>
      </div>
    )
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !matchId) return

    const check = validateAttachmentFile({ type: file.type, size: file.size })
    if (!check.ok) {
      onError?.(check.reason)
      return
    }

    setAttaching(true)
    try {
      // createAttachmentUpload mints the canonical match-scoped path and a
      // signed upload URL; the bytes only land after the server asserts the
      // caller owns the thread.
      const upload = await createChatAttachmentUpload(matchId, file)
      await uploadChatAttachment(file, upload.signedUrl)
      setAttachment({ url: upload.path, name: file.name })
    } catch {
      onError?.('Attachment could not be uploaded. Please try again.')
    } finally {
      setAttaching(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (disabled || sending) return
    const text = cleanComposerText(draft)
    if (!canSubmitDraft(text, Boolean(attachment))) return
    await onSend?.({
      text,
      ...(attachment
        ? { attachmentUrl: attachment.url, attachmentName: attachment.name }
        : {}),
    })
    setDraft('')
    setAttachment(null)
  }

  const submitReady = canSubmitDraft(
    cleanComposerText(draft),
    Boolean(attachment),
  )

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
      <label htmlFor="chat-composer-input" className="sr-only">
        Type a message
      </label>
      <input
        id="chat-composer-input"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          onDraftChange?.(event.target.value)
        }}
        placeholder={placeholder ?? 'Type a message\u2026'}
        maxLength={COMPOSER_MAX_CHARS}
        disabled={disabled}
        autoComplete="off"
        autoFocus={autoFocus}
        className={cn(
          'h-11 flex-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-4 text-sm text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)] focus:border-[var(--cx-brand)] disabled:opacity-60',
          className,
        )}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_ATTACHMENT_MIME.join(',')}
        onChange={handleFile}
        className="sr-only"
        aria-label="Attach a file"
      />
      {attachment ? (
        <span
          title={attachment.name}
          className="hidden max-w-[140px] truncate text-xs text-[var(--cx-brand-strong)] sm:inline"
        >
          {attachment.name}
        </span>
      ) : null}
      {matchId ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending || attaching}
          aria-label="Attach a file"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:border-[var(--cx-border-2)] hover:text-[var(--cx-text-1)] disabled:opacity-50"
        >
          <Paperclip className="size-4" />
        </button>
      ) : null}
      <button
        type="submit"
        disabled={disabled || sending || !submitReady}
        aria-label="Send message"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white transition hover:bg-[var(--cx-brand-strong)] disabled:opacity-50"
      >
        <Send className="size-4" />
      </button>
    </form>
  )
}

export default MessageComposer
