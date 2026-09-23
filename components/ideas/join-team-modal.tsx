'use client'

import { useState } from 'react'
import { Send, Users, Wrench } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'

export interface JoinTeamModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ideaTitle: string
  teamNeededSkills?: string[]
  onSubmit: (pitchMessage: string) => Promise<void> | void
  isSubmitting?: boolean
}

export function JoinTeamModal({
  open,
  onOpenChange,
  ideaTitle,
  teamNeededSkills = [],
  onSubmit,
  isSubmitting = false,
}: JoinTeamModalProps) {
  const [pitchMessage, setPitchMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = pitchMessage.trim()

    try {
      await onSubmit(trimmed)
      setPitchMessage('')
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit join request.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogClose />
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] sm:mx-0">
              <Users className="size-6" />
            </div>
            <DialogTitle className="mt-3">Request to Join Team</DialogTitle>
            <DialogDescription>
              Pitch your skills and experience to the owner of &quot;{ideaTitle}&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {teamNeededSkills.length > 0 && (
              <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3">
                <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-text-4)]">
                  <Wrench className="size-3 text-[var(--cx-brand)]" /> Requested Team Skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {teamNeededSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-lg border border-[var(--cx-brand)]/20 bg-[var(--cx-brand)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--cx-brand-strong)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="pitch-message" className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cx-text-4)]">
                  Your Pitch Message to the Idea Owner
                </span>
                <textarea
                  id="pitch-message"
                  rows={4}
                  maxLength={500}
                  value={pitchMessage}
                  onChange={(e) => setPitchMessage(e.target.value)}
                  placeholder="Introduce yourself, mention your key skills, availability, and why you are excited about this concept..."
                  disabled={isSubmitting}
                  className="w-full resize-none rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3.5 py-3 text-sm leading-5 text-[var(--cx-text-1)] outline-none placeholder:text-[var(--cx-text-4)] focus:border-[var(--cx-brand)] focus:ring-1 focus:ring-[var(--cx-brand)]"
                />
              </label>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--cx-text-4)]">
                <span>Custom pitch messages increase acceptance rates.</span>
                <span>{pitchMessage.length}/500</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-[var(--cx-danger)]" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              icon={<Send className="size-3.5" />}
            >
              {isSubmitting ? 'Sending Request…' : 'Submit Pitch & Request to Join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
