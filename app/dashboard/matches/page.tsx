'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Ban, Flag, HeartHandshake } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberProfileDialog } from '@/components/people'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  Chip,
  EmptyState,
  StatusPill,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import {
  dismissMatch,
  fetchMatches,
  fetchSwipeQuota,
} from '@/client/api/matches'
import { reportUserAction } from '@/app/actions/safety'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { initialsForName } from '@/types/profile'
import { useLiveRegion } from '@/hooks/use-live-region'

export default function MatchesPage() {
  const { polite: announce } = useLiveRegion()
  const [quotaKey] = useState(() => ['matches', 'swipe-quota'].join('/'))
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null)
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    matchId: string
    name: string
  } | null>(null)
  const { data, isLoading, error, refetch } = useQuery(
    keys.matches().join('/'),
    () => fetchMatches(),
  )
  const { data: quotaData } = useQuery(quotaKey, () => fetchSwipeQuota())
  const matches = (data ?? []).filter((m) => m.status !== 'declined')

  async function handleDismiss(matchId: string) {
    if (busyMatchId != null) return
    if (!window.confirm(`Dismiss this match? You won't see them here again.`))
      return
    setBusyMatchId(matchId)
    try {
      await dismissMatch(matchId)
      await refetch().catch(() => undefined)
      showSuccessToast('Match dismissed')
      announce('Match dismissed')
    } catch {
      showErrorToast('That could not be completed. Please try again.')
      announce('Could not dismiss match. Please try again.')
    } finally {
      setBusyMatchId(null)
    }
  }

  async function handleReport(matchId: string, otherUserId: string) {
    if (busyMatchId != null) return
    if (!window.confirm('Report this person to community safety?')) return
    setBusyMatchId(matchId)
    try {
      await reportUserAction(otherUserId, 'inappropriate')
      showSuccessToast(
        'Thanks — our safety team will review it.',
        'You can keep using the app meanwhile.',
      )
      announce('Report submitted. Safety team will review.')
    } catch {
      showErrorToast('That report could not be sent. Please try again.')
      announce('Could not submit report. Please try again.')
    } finally {
      setBusyMatchId(null)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Matches"
          description="Aligned on what matters to you."
          actions={
            quotaData != null ? (
              <Chip active tabIndex={-1} className="pointer-events-none">
                Today&apos;s swipes: {quotaData.remaining} left
              </Chip>
            ) : null
          }
        />

        {isLoading ? (
          <LoadingState label="Loading matches…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : matches.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="size-8" />}
            title="No matches yet"
            description="Keep browsing and aligned people will surface here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <Card key={m.matchId} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setProfileTarget({
                        userId: m.otherUser.id,
                        matchId: m.matchId,
                        name: m.otherUser.fullName,
                      })
                    }
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <Avatar className="size-11 shrink-0 bg-[var(--cx-surface-3)]">
                      {m.otherUser.avatarUrl ? (
                        <AvatarImage
                          src={m.otherUser.avatarUrl}
                          alt={m.otherUser.fullName}
                        />
                      ) : null}
                      <AvatarFallback>
                        {initialsForName(m.otherUser.fullName || '··')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-medium tracking-[-.02em] hover:underline">
                        {m.otherUser.fullName}
                      </p>
                      {m.otherUser.role ? (
                        <p className="truncate text-xs text-[var(--cx-text-3)]">
                          {m.otherUser.role}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  {m.unreadCount > 0 ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-[11px] font-semibold text-white">
                      {m.unreadCount > 9 ? '9+' : m.unreadCount}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {m.status ? (
                    <StatusPill
                      label={m.status === 'active' ? 'Active' : 'Pending'}
                      tone={m.status === 'active' ? 'success' : 'info'}
                      className="shrink-0"
                    />
                  ) : null}
                  {m.matchReason ? (
                    <Chip active tabIndex={-1} className="pointer-events-none">
                      {m.matchReason}
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--cx-text-3)]">
                  {m.lastMessage?.content ??
                    'Say hello to start the conversation.'}
                </p>
                <div className="mt-4">
                  <Link
                    href={`/dashboard/chat/${m.matchId}`}
                    className="flex h-10 w-full items-center justify-center rounded-full bg-[var(--cx-brand)] text-sm font-medium text-white transition hover:bg-[var(--cx-brand-strong)]"
                  >
                    Message
                  </Link>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  {m.status === 'pending' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Ban className="size-3.5" />}
                      disabled={busyMatchId === m.matchId}
                      onClick={() => void handleDismiss(m.matchId)}
                    >
                      Dismiss
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Flag className="size-3.5" />}
                    disabled={busyMatchId === m.matchId}
                    onClick={() => void handleReport(m.matchId, m.otherUser.id)}
                  >
                    Report
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {profileTarget ? (
        <MemberProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setProfileTarget(null)
          }}
          userId={profileTarget.userId}
          matchId={profileTarget.matchId}
          peerName={profileTarget.name}
        />
      ) : null}
    </div>
  )
}
