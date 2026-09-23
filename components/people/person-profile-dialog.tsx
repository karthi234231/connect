'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, MessageCircle } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Input,
} from '@/components/ui'
import {
  ExperienceCard,
  ProfileHeader,
  ProfileSection,
} from '@/components/profile'
import { LoadingState } from '@/components/states/LoadingState'
import { UnavailableState } from '@/components/states/UnavailableState'
import {
  fetchPublicProfile,
  type PublicProfile,
} from '@/client/api/public-profile'
import { queryClient } from '@/client/query/client'
import {
  blockUserAction,
  reportUserAction,
  type ReportReason,
} from '@/app/actions/safety'
import { chatThreadPath } from '@/config/routes'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { personInitials } from './person'

export interface MemberProfileDialogProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When a match exists, enables the "Send message" action. */
  matchId?: string | null
  /** Optional display identity shown while the public projection loads. */
  peerName?: string | null
  peerRole?: string | null
  peerAvatarUrl?: string | null
}

/**
 * `PeerRole`/`peerAvatarUrl` are accepted for a richer loading preview but
 * aren't rendered yet — the interface stays stable for future call sites.
 */
export type PersonProfileDialogProps = MemberProfileDialogProps

const TONES = [
  'bg-[#e4c1aa]',
  'bg-[#b8d8e8]',
  'bg-[#c9e4c5]',
  'bg-[#e8d8f0]',
  'bg-[#f3d9b1]',
]

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
]

function toneForName(name: string): string {
  let hash = 0
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return TONES[Math.abs(hash) % TONES.length]
}

function experiencePeriod(item: {
  startedAt: string | null
  endedAt: string | null
  isCurrent: boolean
}): string | undefined {
  if (item.isCurrent) {
    return item.startedAt ?? undefined
  }
  if (item.startedAt && item.endedAt) {
    return `${item.startedAt} → ${item.endedAt}`
  }
  return item.startedAt ?? item.endedAt ?? undefined
}

type View =
  | { status: 'loading' }
  | { status: 'loaded'; profile: PublicProfile }
  | { status: 'hidden' }
  | { status: 'error' }

export function MemberProfileDialog({
  userId,
  open,
  onOpenChange,
  matchId = null,
  peerName = null,
}: MemberProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={userId} className="max-w-md">
        <DialogClose />
        <MemberProfileView
          userId={userId}
          matchId={matchId}
          peerName={peerName}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

interface MemberProfileViewProps {
  userId: string
  matchId: string | null
  peerName: string | null
  onOpenChange: (open: boolean) => void
}

function MemberProfileView({
  userId,
  matchId,
  peerName,
  onOpenChange,
}: MemberProfileViewProps) {
  const router = useRouter()
  const [view, setView] = useState<View>({ status: 'loading' })
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPublicProfile(userId)
      .then((profile) => {
        if (cancelled) return
        setView(profile ? { status: 'loaded', profile } : { status: 'hidden' })
      })
      .catch(() => {
        if (!cancelled) setView({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const handleMessage = () => {
    if (!matchId) return
    router.push(chatThreadPath(matchId))
  }

  const handleBlock = async () => {
    if (busy) return
    if (
      !window.confirm(
        `Block ${view.status === 'loaded' ? view.profile.identity.fullName : 'this person'}? They won't be able to see you or contact you.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await blockUserAction(userId)
      queryClient.invalidate('settings/blocked')
      showSuccessToast('Blocked', 'They can no longer see you or contact you.')
      onOpenChange(false)
    } catch {
      showErrorToast('That could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleReport = async () => {
    if (busy || !reason) return
    setBusy(true)
    try {
      await reportUserAction(userId, reason, note.trim() || undefined)
      showSuccessToast(
        'Thanks — our safety team will review it.',
        'You can keep using the app meanwhile.',
      )
      onOpenChange(false)
    } catch {
      showErrorToast('That report could not be sent. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {view.status === 'loading' ? (
        <LoadingState
          label={`Loading ${peerName?.trim() ? `${peerName}'s profile` : 'profile'}…`}
          className="min-h-[280px]"
        />
      ) : null}

      {view.status === 'hidden' ? (
        <UnavailableState
          title="Profile unavailable"
          description="This profile is private, removed, or blocked — so it's hidden from you right now."
        />
      ) : null}

      {view.status === 'error' ? (
        <div className="space-y-4">
          <UnavailableState
            title="Couldn't load this profile"
            description="Something went wrong fetching this profile. Please try again."
          />
          <Button
            variant="secondary"
            className="mx-auto flex w-fit"
            onClick={() => {
              setView({ status: 'loading' })
              fetchPublicProfile(userId)
                .then((profile) =>
                  setView(
                    profile
                      ? { status: 'loaded', profile }
                      : { status: 'hidden' },
                  ),
                )
                .catch(() => setView({ status: 'error' }))
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {view.status === 'loaded' ? (
        <>
          <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-0.5">
            <ProfileHeader
              name={view.profile.identity.fullName}
              headline={
                view.profile.providerHeadline ??
                view.profile.headline ??
                view.profile.currentRole ??
                'Member'
              }
              location={
                view.profile.providerLocation?.label?.trim() ||
                view.profile.providerLocation?.city ||
                view.profile.city ||
                undefined
              }
              bio={view.profile.bio ?? undefined}
              initials={personInitials(view.profile.identity.fullName)}
              tone={toneForName(view.profile.identity.fullName)}
              availability={
                view.profile.availability.days.length > 0
                  ? `Available ${view.profile.availability.days.join(' · ')}`
                  : undefined
              }
              availabilityTone="info"
              skills={view.profile.skills}
            />

            {view.profile.bio || view.profile.idea ? (
              <ProfileSection title="About">
                <div className="space-y-2 text-sm leading-5">
                  {view.profile.bio ? (
                    <p className="text-[var(--cx-text-2)]">
                      {view.profile.bio}
                    </p>
                  ) : null}
                  {view.profile.idea ? (
                    <p className="text-xs text-[var(--cx-text-3)]">
                      <span className="font-medium text-[var(--cx-text-2)]">
                        Building:
                      </span>{' '}
                      {view.profile.idea}
                    </p>
                  ) : null}
                </div>
              </ProfileSection>
            ) : null}

            {view.profile.lookingFor.roles.length > 0 ||
            view.profile.offering.categories.length > 0 ? (
              <ProfileSection title="Collaboration">
                {view.profile.lookingFor.roles.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      Looking for
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {view.profile.lookingFor.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-[var(--cx-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--cx-brand-strong)]"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {view.profile.offering.categories.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      Offering
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {view.profile.offering.categories.map((category) => (
                        <span
                          key={category}
                          className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {view.profile.sharedContext.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                      Shared with you
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {view.profile.sharedContext.map((context) => (
                        <span
                          key={`${context.source}:${context.label}`}
                          className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
                        >
                          {context.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </ProfileSection>
            ) : null}

            {view.profile.experience.length > 0 ? (
              <ProfileSection title="Experience">
                <div className="space-y-2">
                  {view.profile.experience.map((item) => (
                    <ExperienceCard
                      key={item.id}
                      role={item.title}
                      org={item.company ?? ''}
                      period={experiencePeriod(item)}
                      current={item.isCurrent}
                      description={item.description ?? undefined}
                      source={item.providerOrigin ? 'LinkedIn' : undefined}
                    />
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {view.profile.identity.hasProviderOriginAvatar ||
            view.profile.providerHeadline ? (
              <p className="px-1 text-[10px] text-[var(--cx-text-4)]">
                {view.profile.identity.hasProviderOriginAvatar
                  ? 'Profile photo from LinkedIn. '
                  : ''}
                {view.profile.providerHeadline
                  ? 'Headline from LinkedIn. '
                  : ''}
              </p>
            ) : null}
          </div>

          {reportOpen ? (
            <div className="mt-4 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3">
              <p className="text-xs font-medium text-[var(--cx-text-2)]">
                Why are you reporting{' '}
                {view.profile.identity.fullName.split(' ')[0]}?
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REPORT_REASONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={reason === option.value}
                    onClick={() => setReason(option.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                      reason === option.value
                        ? 'border-[var(--cx-danger)] bg-[var(--cx-danger-soft)] text-[var(--cx-danger)]'
                        : 'border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note for our safety team (optional)…"
                aria-label="Report note"
                maxLength={500}
                className="mt-2 h-9 text-xs"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setReportOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy || !reason}
                  onClick={() => void handleReport()}
                >
                  Send report
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {matchId ? (
                <Button
                  icon={<MessageCircle className="size-4" />}
                  onClick={handleMessage}
                >
                  Send message
                </Button>
              ) : null}
              <Button
                variant="secondary"
                icon={<Flag className="size-4" />}
                disabled={busy}
                onClick={() => setReportOpen(true)}
              >
                Report
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void handleBlock()}
              >
                Block
              </Button>
            </div>
          )}
        </>
      ) : null}
    </>
  )
}

export const PersonProfileDialog = MemberProfileDialog
