'use client'

import { useRouter } from 'next/navigation'
import { MessageSquare, Sparkles, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@/components/ui'
import { chatThreadPath } from '@/config/routes'

export interface MatchModalProps {
  open: boolean
  onClose: () => void
  matchedName: string
  matchedRole?: string | null
  matchedAvatarUrl?: string | null
  matchedInitials?: string
  matchedTone?: string
  matchId?: string | null
}

export function MatchModal({
  open,
  onClose,
  matchedName,
  matchedRole,
  matchedAvatarUrl,
  matchedInitials = '··',
  matchedTone = 'bg-[#e4c1aa]',
  matchId,
}: MatchModalProps) {
  const router = useRouter()

  if (!open) return null

  const handleSendMessage = () => {
    onClose()
    if (matchId) {
      router.push(chatThreadPath(matchId))
    } else {
      router.push('/dashboard/chat')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div
        className="relative w-full max-w-sm cx-scale-up rounded-[28px] border border-[color-mix(in_srgb,var(--cx-brand)_45%,transparent)] bg-[var(--cx-surface-1)] p-6 shadow-[var(--cx-shadow-dialog)] text-center overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
      >
        {/* Background glow decoration */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-[color-mix(in_srgb,var(--cx-brand)_25%,transparent)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 size-60 rounded-full bg-[color-mix(in_srgb,var(--cx-info)_20%,transparent)] blur-3xl"
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full text-[var(--cx-text-3)] hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)] transition"
          aria-label="Close match overlay"
        >
          <X className="size-4" />
        </button>

        <div className="relative z-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] shadow-[0_0_20px_rgba(208,164,91,0.3)] mb-4">
            <Sparkles className="size-7 animate-pulse" />
          </div>

          <h2
            id="match-modal-title"
            className="font-display text-2xl font-bold tracking-tight text-[var(--cx-text-1)]"
          >
            It&apos;s a Match! 🎉
          </h2>
          <p className="mt-1 text-sm text-[var(--cx-text-3)]">
            You and <span className="font-semibold text-[var(--cx-text-1)]">{matchedName}</span> expressing mutual interest.
          </p>

          <div className="my-6 flex items-center justify-center gap-3">
            <Avatar avatarClassName="size-20 border-2 border-[var(--cx-brand)] shadow-lg" className={matchedTone}>
              {matchedAvatarUrl ? (
                <AvatarImage src={matchedAvatarUrl} alt={matchedName} />
              ) : (
                <AvatarFallback className="text-xl font-bold text-[#332d3d]">
                  {matchedInitials}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          {matchedRole ? (
            <p className="mb-6 text-xs font-medium text-[var(--cx-brand-strong)]">
              {matchedRole}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2 font-semibold shadow-[0_0_16px_rgba(208,164,91,0.25)]"
              onClick={handleSendMessage}
            >
              <MessageSquare className="size-4.5" />
              Send a Message
            </Button>
            <Button
              variant="ghost"
              size="md"
              className="w-full justify-center text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]"
              onClick={onClose}
            >
              Keep Swiping
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
