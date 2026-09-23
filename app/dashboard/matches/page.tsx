'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Ban, Flag, HeartHandshake, MessageSquare, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberProfileDialog } from '@/components/people'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Skeleton,
  StatusPill,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
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

type MatchFilter = 'all' | 'active' | 'pending'

export default function MatchesPage() {
  const { polite: announce } = useLiveRegion()
  const [quotaKey] = useState(() => ['matches', 'swipe-quota'].join('/'))
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all')
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

  const filteredMatches = useMemo(() => {
    if (matchFilter === 'active') return matches.filter((m) => m.status === 'active')
    if (matchFilter === 'pending') return matches.filter((m) => m.status === 'pending')
    return matches
  }, [matches, matchFilter])

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
          eyebrow="Connections"
          title="Matches"
          description="Aligned on what matters to you."
          actions={
            quotaData != null ? (
              <Badge variant="brand" pulse>
                <Sparkles className="size-3" />
                {quotaData.remaining} swipes left today
              </Badge>
            ) : null
          }
        />

        {/* Status Filter Pills */}
        <div
          data-horizontal-scroll
          className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"
        >
          <Chip
            active={matchFilter === 'all'}
            onClick={() => setMatchFilter('all')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            All matches ({matches.length})
          </Chip>
          <Chip
            active={matchFilter === 'active'}
            onClick={() => setMatchFilter('active')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            Active
          </Chip>
          <Chip
            active={matchFilter === 'pending'}
            onClick={() => setMatchFilter('pending')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            Pending
          </Chip>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="cx-glass-card rounded-[20px] p-5 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filteredMatches.length === 0 ? (
          <div className="cx-glass-card rounded-[28px] p-8 text-center">
            <EmptyState
              icon={<HeartHandshake className="size-8 text-[var(--cx-brand)]" />}
              title={matchFilter === 'all' ? 'No matches yet' : 'No matching connections'}
              description={
                matchFilter === 'all'
                  ? 'Keep browsing discover cards and aligned people will surface here.'
                  : 'Try selecting a different filter pill to view all connections.'
              }
              action={
                <Link href="/dashboard/discover">
                  <Button icon={<Sparkles className="size-4" />}>
                    Discover profiles
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((m, index) => (
              <div
                key={m.matchId}
                className="cx-fade-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Card glass className="flex flex-col p-5 h-full justify-between">
                  <div>
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
                        className="flex min-w-0 flex-1 items-start gap-3 text-left group"
                      >
                        <Avatar className="size-11 shrink-0 bg-[var(--cx-surface-3)] ring-2 ring-[var(--cx-border-1)] group-hover:ring-[var(--cx-brand)] transition-all duration-200">
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
                          <p className="truncate font-display text-lg font-medium tracking-[-.02em] text-[var(--cx-text-1)] group-hover:text-[var(--cx-brand-strong)] transition-colors duration-200">
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
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-[11px] font-semibold text-white cx-pulse-glow">
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

                    <p className="mt-3 line-clamp-2 text-sm leading-5 text-[var(--cx-text-3)]">
                      {m.lastMessage?.content ??
                        'Say hello to start the conversation.'}
                    </p>
                  </div>

                  <div className="mt-5 space-y-2">
                    <Link
                      href={`/dashboard/chat/${m.matchId}`}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--cx-brand)] text-sm font-medium text-white transition-all duration-200 hover:bg-[var(--cx-brand-strong)] hover:shadow-[0_4px_16px_rgba(208,164,91,0.25)] active:scale-[0.98]"
                    >
                      <MessageSquare className="size-4" />
                      Message
                    </Link>

                    <div className="flex items-center justify-end gap-2 pt-1">
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
                  </div>
                </Card>
              </div>
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
