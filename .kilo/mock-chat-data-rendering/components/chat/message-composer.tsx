'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface ComposerSendDraft {
  text: string
  attachmentUrl?: string
  attachmentName?: string
}

interface MessageComposerProps {
  className?: string
  disabled?: boolean
  sending?: boolean
  placeholder?: string
  autoFocus?: boolean
  /** Enables the local attachment picker (object-URL preview for the showcase). */
  allowAttachments?: boolean
  onSend?: (draft: ComposerSendDraft) => void | Promise<void>
  onDraftChange?: (text: string) => void
}

const COMPOSER_MAX_CHARS = 4000

export function MessageComposer({
  className,
  disabled = false,
  sending = false,
  placeholder,
  autoFocus = false,
  allowAttachments = false,
  onSend,
  onDraftChange,
}: MessageComposerProps): ReactNode {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && !disabled) textInputRef.current?.focus()
  }, [autoFocus, disabled])

  const trimmed = draft.trim()
  const submitReady = trimmed.length > 0 || attachment !== null

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAttachment({ url: URL.createObjectURL(file), name: file.name })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (disabled || sending || !submitReady) return
    await onSend?.({
      text: trimmed,
      ...(attachment
        ? { attachmentUrl: attachment.url, attachmentName: attachment.name }
        : {}),
    })
    setDraft('')
    setAttachment(null)
    onDraftChange?.('')
    setTimeout(() => textInputRef.current?.focus(), 0)
  }

  return (
    <div className="flex flex-col gap-2">
      {attachment ? (
        <div className="flex items-center gap-2 self-start rounded-lg border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1.5 text-xs">
          <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[var(--cx-surface-3)] text-[var(--cx-brand-strong)]">
            <Paperclip className="size-3.5" />
          </div>
          <span className="block max-w-[160px] truncate font-medium text-[var(--cx-text-1)]">
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="rounded-full p-1 text-[var(--cx-text-4)] hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Input pill with the attachment icon tucked inside, WhatsApp-style. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] pl-4 pr-1.5 transition focus-within:border-[var(--cx-brand)]">
          <label htmlFor="chat-composer-input" className="sr-only">
            Type a message
          </label>
          <input
            id="chat-composer-input"
            ref={textInputRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              onDraftChange?.(event.target.value)
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                void handleSubmit(event)
              }
            }}
            placeholder={placeholder ?? 'Type a message\u2026'}
            maxLength={COMPOSER_MAX_CHARS}
            disabled={disabled}
            autoComplete="off"
            className={cn(
              'h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)] disabled:opacity-60',
              className,
            )}
          />
          {allowAttachments ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFile}
                className="sr-only"
                aria-label="Attach a file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || sending}
                aria-label="Attach a file"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-brand-strong)] disabled:opacity-50"
              >
                <Paperclip className="size-[18px]" />
              </button>
            </>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={disabled || sending || !submitReady}
          aria-label="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white shadow-[0_6px_16px_rgba(207,159,82,.35)] transition hover:bg-[var(--cx-brand-strong)] disabled:opacity-40 disabled:shadow-none"
        >
          <Send className="size-[18px] translate-x-px" />
        </button>
      </form>
    </div>
  )
}

export default MessageComposer
