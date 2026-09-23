'use client'

import { useState } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { Button, FormError, FormField, Textarea } from '@/components/ui'
import { submitFeedbackAction } from '@/app/actions/feedback'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

const MAX_FEEDBACK_LENGTH = 1000

interface FeedbackFormProps {
  /** Optional context label (e.g. the page that hosts the form). */
  context?: string
}

export function FeedbackForm({ context }: FeedbackFormProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (sending || message.trim().length === 0) return
    setSending(true)
    setError(null)
    try {
      await submitFeedbackAction({
        message,
        ...(context ? { context } : {}),
      })
      setMessage('')
      setSent(true)
      showSuccessToast('Feedback sent', 'Thanks — this helps shape Connect.')
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : null
      setError(detail ?? 'Feedback could not be sent. Please try again.')
      showErrorToast('Feedback could not be sent', detail ?? undefined)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-surface-2)] text-[var(--cx-brand-strong)]">
          <MessageSquareHeart className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <FormField
            id="feedback-message"
            label="How can we make Connect better?"
            description="Real feedback from real use. We read every message."
          >
            <Textarea
              id="feedback-message"
              name="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_FEEDBACK_LENGTH}
              placeholder="What worked, what got in the way, what you wish existed…"
            />
            <span className="mt-1 block text-right text-[10px] text-[var(--cx-text-4)]">
              {message.length}/{MAX_FEEDBACK_LENGTH}
            </span>
          </FormField>
          {error ? <FormError>{error}</FormError> : null}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <Button
          type="submit"
          size="sm"
          disabled={sending || message.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send feedback'}
        </Button>
        {sent ? (
          <span className="text-xs text-[var(--cx-success)]">
            Sent — thank you.
          </span>
        ) : null}
      </div>
    </form>
  )
}
