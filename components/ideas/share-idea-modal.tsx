'use client'

import { useState } from 'react'
import { Check, Copy, Mail, Share2 } from 'lucide-react'
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
import { showSuccessToast } from '@/lib/toast'

export interface ShareIdeaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  idea: {
    id: string
    title: string
    problem?: string
    author?: string
  }
}

export function ShareIdeaModal({
  open,
  onOpenChange,
  idea,
}: ShareIdeaModalProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/ideas/${idea.id}`
      : `https://connect.app/dashboard/ideas/${idea.id}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showSuccessToast('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      showSuccessToast('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareText = `Check out this idea: "${idea.title}" on Connect!`

  const handleEmailShare = () => {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(
      `Check out this startup idea: ${idea.title}`,
    )}&body=${encodeURIComponent(
      `${shareText}\n\n${idea.problem ? `Problem: ${idea.problem}\n\n` : ''}${shareUrl}`,
    )}`
    window.open(mailtoUrl, '_blank')
  }

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText,
    )}&url=${encodeURIComponent(shareUrl)}`
    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
  }

  const handleLinkedinShare = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      shareUrl,
    )}`
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose />
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] sm:mx-0">
            <Share2 className="size-6" />
          </div>
          <DialogTitle className="mt-3">Share Idea</DialogTitle>
          <DialogDescription>
            Spread the word or invite collaborators to review &quot;{idea.title}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="share-direct-link" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cx-text-4)]">
              Direct Link
            </label>
            <div className="flex items-center gap-2">
              <input
                id="share-direct-link"
                type="text"
                readOnly
                value={shareUrl}
                className="w-full min-w-0 truncate rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-2 text-xs text-[var(--cx-text-2)] outline-none focus:border-[var(--cx-brand)]"
              />
              <Button
                variant={copied ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => void handleCopy()}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--cx-text-4)]">
              Share via
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleEmailShare}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-2.5 text-xs font-medium text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
              >
                <Mail className="size-4 text-[var(--cx-brand)]" />
                Email
              </button>
              <button
                type="button"
                onClick={handleTwitterShare}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-2.5 text-xs font-medium text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
              >
                <svg className="size-4 fill-current text-[#1DA1F2]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X / Twitter
              </button>
              <button
                type="button"
                onClick={handleLinkedinShare}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-2.5 text-xs font-medium text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-3)] hover:text-[var(--cx-text-1)]"
              >
                <svg className="size-4 fill-current text-[#0A66C2]" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.64a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28" />
                </svg>
                LinkedIn
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
