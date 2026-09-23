'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Code, FileCode, FileText, Paperclip, Send, X } from 'lucide-react'
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
  extractCodeSnippetDraft,
  getFileCategory,
  getFileExtensionLabel,
} from '@/lib/chat/markdown'
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
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (variant === 'composer' && autoFocus && !disabled) {
      textInputRef.current?.focus()
    }
  }, [variant, autoFocus, disabled, matchId])

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
    setTimeout(() => {
      textInputRef.current?.focus()
    }, 0)
  }

  const submitReady = canSubmitDraft(
    cleanComposerText(draft),
    Boolean(attachment),
  )

  const isImageAttachment = (name: string) =>
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)

  const detectedCodeSnippet = extractCodeSnippetDraft(draft)

  const handleInsertCodeSnippet = () => {
    if (disabled || sending) return
    const text = draft.trim()
    if (text.includes('```')) return
    const snippetTemplate = text
      ? `\n\`\`\`ts\n${text}\n\`\`\``
      : `\`\`\`ts\n// Code snippet\n\n\`\`\``
    const updated = draft ? `${draft}${snippetTemplate}` : snippetTemplate
    setDraft(updated)
    onDraftChange?.(updated)
    setTimeout(() => {
      textInputRef.current?.focus()
    }, 0)
  }

  const handleRemoveCodeSnippet = () => {
    const updated = draft.replace(/```[a-zA-Z0-9_+-]*\n?([\s\S]*?)```/g, '').trim()
    setDraft(updated)
    onDraftChange?.(updated)
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {attachment || detectedCodeSnippet ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-2 text-xs">
          {attachment ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-2.5 py-1.5 shadow-xs">
              {isImageAttachment(attachment.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.url}
                  alt="Attachment preview"
                  className="size-7 rounded object-cover"
                />
              ) : (
                <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[var(--cx-surface-3)] text-[var(--cx-brand-strong)]">
                  {getFileCategory(attachment.name) === 'code' ? (
                    <FileCode className="size-3.5" />
                  ) : getFileCategory(attachment.name) === 'pdf' ||
                    getFileCategory(attachment.name) === 'document' ? (
                    <FileText className="size-3.5" />
                  ) : (
                    <Paperclip className="size-3.5" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block max-w-[160px] truncate font-medium text-[var(--cx-text-1)] sm:max-w-[220px]">
                  {attachment.name}
                </span>
                <span className="block text-[9px] font-mono uppercase text-[var(--cx-text-4)]">
                  {getFileExtensionLabel(attachment.name)} Attachment
                </span>
              </div>
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

          {detectedCodeSnippet ? (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100 shadow-xs">
              <Code className="size-3.5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1 text-left">
                <span className="inline-block rounded bg-amber-400/20 px-1 text-[9px] font-bold uppercase text-amber-300">
                  {detectedCodeSnippet.lang}
                </span>
                <span className="ml-1.5 max-w-[150px] truncate text-[11px] text-zinc-300 sm:max-w-[200px]">
                  {detectedCodeSnippet.codePreview}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCodeSnippet}
                aria-label="Remove code block"
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={handleInsertCodeSnippet}
          disabled={disabled || sending}
          aria-label="Insert code snippet"
          title="Insert code block"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] transition hover:border-[var(--cx-border-2)] hover:text-[var(--cx-brand-strong)] disabled:opacity-50"
        >
          <Code className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_ATTACHMENT_MIME.join(',')}
          onChange={handleFile}
          className="sr-only"
          aria-label="Attach a file"
        />
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
    </div>
  )
}

export default MessageComposer


