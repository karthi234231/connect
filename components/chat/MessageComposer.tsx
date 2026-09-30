'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Code,
  FileCode,
  FileText,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  ALLOWED_ATTACHMENT_MIME,
  formatFileSize,
  validateAttachmentFile,
} from '@/lib/chat/attachment'
import {
  buildComposerPlaceholder,
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
import { useAttachmentSignedUrl } from '@/hooks/use-attachment-urls'

export interface ComposerSendDraft {
  text: string
  attachmentUrl?: string
  attachmentName?: string
}

/** Above this many rows the composer stops growing and scrolls instead. */
const MAX_COMPOSER_ROWS = 6

/** Remaining-characters counter becomes visible once this close to the cap. */
const CHARS_CAP_THRESHOLD = 80

interface MessageComposerProps {
  className?: string
  /** Offline/locked threads disable the input. */
  disabled?: boolean
  /** An in-flight send disables the affordance. */
  sending?: boolean
  placeholder?: string
  /** First name for the personalized "Message …" placeholder. */
  peerName?: string
  autoFocus?: boolean
  /** Required for the attachment upload flow (createAttachmentUpload). */
  matchId?: string
  /** Resolves with `false` when the send failed — the composer then keeps the
   * draft + attachment instead of clearing them (retry is a real affordance). */
  onSend?: (draft: ComposerSendDraft) => void | Promise<boolean> | Promise<void>
  onError?: (message: string) => void
  /** Fired with the raw draft on every keystroke. */
  onDraftChange?: (text: string) => void
}

function isImageAttachment(name: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)
}

/** Cap the composer's height at ~`MAX_COMPOSER_ROWS` rows of its own line-height. */
function computeMaxComposerHeight(el: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(el)
  const lineHeight =
    style.lineHeight === 'normal'
      ? parseFloat(style.fontSize) * 1.4
      : parseFloat(style.lineHeight)
  return Math.round(lineHeight * MAX_COMPOSER_ROWS)
}

export function MessageComposer({
  className,
  disabled = false,
  sending = false,
  placeholder,
  peerName,
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
    size: number
  } | null>(null)
  const [attaching, setAttaching] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  // The image preview must never render the storage PATH directly (always
  // 404s) — resolve it through the signed-URL pipeline before `<img src>`.
  const isImage = attachment != null && isImageAttachment(attachment.name)
  const previewUrl = useAttachmentSignedUrl(
    isImage ? attachment?.url : null,
  )

  // Auto-grow: pin the height to the content, capped at MAX_COMPOSER_ROWS.
  const resizeTextarea = useCallback(() => {
    const el = textAreaRef.current
    if (!el) return
    const maxHeight = computeMaxComposerHeight(el)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [draft, resizeTextarea])

  useEffect(() => {
    window.addEventListener('resize', resizeTextarea)
    return () => window.removeEventListener('resize', resizeTextarea)
  }, [resizeTextarea])

  useEffect(() => {
    if (autoFocus && !disabled) {
      textAreaRef.current?.focus()
    }
  }, [autoFocus, disabled, matchId])

  async function performSend() {
    if (disabled || sending) return
    const text = cleanComposerText(draft)
    if (!canSubmitDraft(text, Boolean(attachment))) return
    const ok = await onSend?.({
      text,
      ...(attachment
        ? { attachmentUrl: attachment.url, attachmentName: attachment.name }
        : {}),
    })
    // A failed send resolves `false` — keep the draft so the user can retry
    // (the failed bubble's retry affordance resends with the same text).
    if (ok === false) return
    setDraft('')
    setAttachment(null)
    onDraftChange?.('')
    setTimeout(() => {
      textAreaRef.current?.focus()
    }, 0)
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
      setAttachment({ url: upload.path, name: file.name, size: file.size })
    } catch {
      onError?.('Attachment could not be uploaded. Please try again.')
    } finally {
      setAttaching(false)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void performSend()
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    // Leave IME composition Enter keys untouched (Enter confirms the candidate).
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void performSend()
  }

  const submitReady = canSubmitDraft(
    cleanComposerText(draft),
    Boolean(attachment),
  )

  const remainingChars = COMPOSER_MAX_CHARS - draft.length
  const nearCharsCap = remainingChars <= CHARS_CAP_THRESHOLD

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
      textAreaRef.current?.focus()
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
                previewUrl.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl.url}
                    alt="Attachment preview"
                    className="size-7 rounded object-cover"
                  />
                ) : (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded bg-[var(--cx-surface-3)] text-[var(--cx-text-4)]">
                    <Paperclip className="size-3.5" />
                  </div>
                )
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
                  {getFileExtensionLabel(attachment.name)} · {formatFileSize(attachment.size)}
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
        {/* WhatsApp-style input pill with the code + attachment buttons tucked inside. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] pl-4 pr-1.5 transition focus-within:border-[var(--cx-brand)]">
          <textarea
            id="chat-composer-input"
            ref={textAreaRef}
            value={draft}
            rows={1}
            aria-describedby="chat-composer-remaining"
            onChange={(event) => {
              setDraft(event.target.value)
              onDraftChange?.(event.target.value)
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={placeholder ?? buildComposerPlaceholder(peerName)}
            maxLength={COMPOSER_MAX_CHARS}
            disabled={disabled}
            autoComplete="off"
            autoFocus={autoFocus}
            className={cn(
              'min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 text-sm leading-snug text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)] disabled:opacity-60',
              className,
            )}
          />
          <span
            id="chat-composer-remaining"
            className={cn(
              'shrink-0 text-[10px] font-medium tabular-nums text-[var(--cx-text-4)]',
              !nearCharsCap && 'sr-only',
            )}
          >
            {remainingChars} characters remaining
          </span>
          <button
            type="button"
            onClick={handleInsertCodeSnippet}
            disabled={disabled || sending}
            aria-label="Insert code snippet"
            title="Insert code block"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-brand-strong)] disabled:opacity-50"
          >
            <Code className="size-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_ATTACHMENT_MIME.join(',')}
            onChange={handleFile}
            className="sr-only"
            tabIndex={-1}
            aria-label="Attach a file"
          />
          {matchId ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || sending || attaching}
              aria-label="Attach a file"
              title="Attach a file"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-3)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-brand-strong)] disabled:opacity-50"
            >
              <Paperclip className="size-[18px]" />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={disabled || sending || !submitReady}
          aria-label="Send message"
          title="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white shadow-[0_6px_16px_rgba(207,159,82,.35)] transition hover:bg-[var(--cx-brand-strong)] disabled:opacity-40 disabled:shadow-none"
        >
          {sending ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <Send className="size-[18px] translate-x-px" />
          )}
        </button>
      </form>
    </div>
  )
}

export default MessageComposer