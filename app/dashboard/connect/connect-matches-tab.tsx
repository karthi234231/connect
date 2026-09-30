'use client'

// Connect · Matches tab — the accepted/aligned people you can message.
// Reads the same getMatchesAction the /dashboard/matches page uses; each card
// deep-links to the existing chat thread.
import Link from 'next/link'
import { useState } from 'react'
import { HeartHandshake, MessageSquare, Sparkles } from 'lucide-react'

import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchMatches } from '@/client/api/matches'
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
import { MemberProfileDialog } from '@/components/people'
import { chatThreadPath } from '@/config/routes'
import { initialsForName } from '@/types/profile'

export function ConnectMatchesTab() {
  const [matchKey] = useState(() => keys.matches().join('/'))
  const { data, isLoading, error, refetch } = useQuery(matchKey, () =>
    fetchMatches(),
  )
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    matchId: string
    name: string
  } | null>(null)

  const matches = (data ?? []).filter((m) => m.status !== 'declined')

  if (isLoading) return <LoadingState label="Loading matches…" />
  if (error) return <ErrorState onRetry={() => void refetch()} />

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        <EmptyState
          icon={<HeartHandshake className="size-7 text-[var(--cx-brand)]" />}
          title="No matches yet"
          description="Keep swiping on Discover and aligned people will surface here."
          action={
            <Link href="/dashboard/discover">
              <Button size="sm" icon={<Sparkles className="size-4" />}>
                Discover profiles
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <Card key={match.matchId} className="flex flex-col gap-3 p-4">
          <button
            type="button"
            onClick={() =>
              setProfileTarget({
                userId: match.otherUser.id,
                matchId: match.matchId,
                name: match.otherUser.fullName,
              })
            }
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <Avatar className="bg-[var(--cx-surface-3)]">
              {match.otherUser.avatarUrl ? (
                <AvatarImage
                  src={match.otherUser.avatarUrl}
                  alt={match.otherUser.fullName}
                />
              ) : null}
              <AvatarFallback>
                {initialsForName(match.otherUser.fullName || '··')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium hover:underline">
                {match.otherUser.fullName}
              </p>
              {match.otherUser.role ? (
                <p className="truncate text-xs text-[var(--cx-text-3)]">
                  {match.otherUser.role}
                </p>
              ) : null}
            </div>
            {match.unreadCount > 0 ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--cx-brand)] text-[10px] font-semibold text-white">
                {match.unreadCount > 9 ? '9+' : match.unreadCount}
              </span>
            ) : null}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={match.status === 'active' ? 'Active' : 'Pending'}
              tone={match.status === 'active' ? 'success' : 'info'}
            />
            {match.matchReason ? (
              <Chip className="pointer-events-none" active>
                {match.matchReason}
              </Chip>
            ) : null}
          </div>

          <p className="line-clamp-2 text-xs leading-5 text-[var(--cx-text-3)]">
            {match.lastMessage?.content ?? 'Say hello to start the conversation.'}
          </p>

          <Link
            href={chatThreadPath(match.matchId)}
            className="mt-auto flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--cx-brand)] text-xs font-medium text-white transition hover:bg-[var(--cx-brand-strong)]"
          >
            <MessageSquare className="size-3.5" />
            Message
          </Link>
        </Card>
      ))}

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