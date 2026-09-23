'use client'

// Interactive swipe deck: deck state, refill via the opaque cursor contract,
// and swipe submission with a per-gesture idempotency key. The generic
// SwipeDeck (components/people) presents people[0]; this module feeds it the
// ranked DiscoverCandidateDTO projection and owns every server interaction.
import { useCallback, useMemo, useState } from 'react'
import { RefreshCw, Sparkles, UserCheck } from 'lucide-react'

import { fetchDiscoverBatchAction } from '@/app/actions/discover'
import { performSwipe } from '@/client/api/matches'
import { ErrorState } from '@/components/states/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  MemberProfileDialog,
  SwipeDeck,
  type Person,
} from '@/components/people'
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui'
import { useLiveRegion } from '@/hooks/use-live-region'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import type {
  DiscoverBatch,
  DiscoverCandidateDTO,
} from '@/services/discover/candidates.service'
import { initialsForName } from '@/types/profile'

export type DeckBatch =
  DiscoverBatch | { items: []; nextCursorToken: null; version: 'invalid' }

const TONES = [
  'bg-[#e4c1aa]',
  'bg-[#b8d8e8]',
  'bg-[#c9e4c5]',
  'bg-[#e8d8f0]',
  'bg-[#f3d9b1]',
]

function toneForName(name: string): string {
  let hash = 0
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0
  }
  return TONES[Math.abs(hash) % TONES.length]
}

/** Project a ranked candidate onto the generic Person card model. */
function toPerson(candidate: DiscoverCandidateDTO): Person {
  const { profile, score, recommendation } = candidate
  const availability = profile.availability.days ?? []
  const factors = Object.entries(recommendation.factors ?? {})
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  return {
    id: profile.id,
    name: profile.fullName,
    role: profile.role,
    company: '',
    initials: initialsForName(profile.fullName || '··'),
    tone: toneForName(profile.fullName),
    note: profile.bio ?? '',
    tags: profile.skills,
    location: profile.city ?? '',
    availability:
      availability.length > 0 ? `Available ${availability.join(' · ')}` : '',
    mutuals: 0,
    experience: profile.commitmentLevel ?? '',
    interests: profile.lookingFor.roles,
    education: (profile.offering?.categories ?? []).join(' · '),
    avatarUrl: profile.avatarUrl ?? null,
    score,
    factors,
  }
}

export function DiscoverDeck({ initialBatch }: { initialBatch: DeckBatch }) {
  const { polite: announce } = useLiveRegion()
  const [items, setItems] = useState<DiscoverCandidateDTO[]>(() => [
    ...initialBatch.items,
  ])
  const [cursor, setCursor] = useState<string | null>(
    () => initialBatch.nextCursorToken,
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matchedName, setMatchedName] = useState<string | null>(null)
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
  } | null>(null)

  const top = items[0] ?? null
  const exhausted = items.length === 0 && cursor == null
  const remaining = useMemo(() => items.length, [items.length])

  const deckPeople = useMemo(() => items.map(toPerson), [items])
  const candidateById = useMemo(
    () => new Map(items.map((item) => [item.profile.id, item])),
    [items],
  )

  const refill = useCallback(async () => {
    if (loadingMore || cursor == null) return
    setLoadingMore(true)
    setLoadError(false)
    try {
      const batch = (await fetchDiscoverBatchAction(cursor)) as DeckBatch
      setItems((current) => [...current, ...batch.items])
      setCursor(batch.nextCursorToken)
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore])

  async function handleSwipe(person: Person, action: 'like' | 'pass') {
    if (busyId != null) return
    const candidate = candidateById.get(person.id)
    if (!candidate) return
    const id = candidate.profile.id
    setBusyId(id)
    try {
      const result = await performSwipe(
        candidate.profile.id,
        action,
        candidate.recommendation.recommendationId,
        crypto.randomUUID(),
      )
      setItems((current) => current.filter((item) => item.profile.id !== id))
      if (result.matchCreated) {
        setMatchedName(candidate.profile.fullName)
        showSuccessToast(`You matched with ${candidate.profile.fullName}!`)
        announce(`You matched with ${candidate.profile.fullName}`)
      } else {
        announce(
          action === 'like' ? 'Liked. Next profile.' : 'Passed. Next profile.',
        )
      }
      if (remaining <= 2) await refill()
    } catch {
      showErrorToast('That swipe could not be saved. Please try again.')
      announce('Could not save that swipe. Please try again.')
      throw new Error('swipe-failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Discover"
        title="Meet your people"
        description="Swipe through aligned profiles — every card is server-ranked."
        actions={
          remaining > 0 ? (
            <Badge variant="brand" pulse className="cx-fade-in">
              <Sparkles className="size-3" />
              {remaining} aligned deck profiles
            </Badge>
          ) : null
        }
      />

      {matchedName ? (
        <div className="mb-6 cx-scale-up rounded-[24px] border border-[color-mix(in_srgb,var(--cx-brand)_40%,transparent)] bg-[var(--cx-surface-2)]/90 backdrop-blur-md p-5 shadow-[var(--cx-shadow-glow)]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--cx-text-1)]">
                It&apos;s a match with {matchedName} 🎉
              </p>
              <p className="mt-0.5 text-xs text-[var(--cx-text-3)]">
                Head to Messages to start the conversation.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {top == null ? (
        loadingMore ? (
          <div className="space-y-4">
            <div className="cx-glass-card rounded-[28px] p-6 h-[440px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ) : loadError ? (
          <ErrorState onRetry={() => void refill()} />
        ) : exhausted || initialBatch.version === 'invalid' ? (
          <div className="cx-glass-card rounded-[28px] p-8 text-center">
            <EmptyState
              icon={<Sparkles className="size-8" />}
              title="All caught up!"
              description="No more profiles right now — check back soon for fresh AI-ranked recommendations."
              action={
                cursor != null ? (
                  <Button
                    variant="secondary"
                    icon={<RefreshCw className="size-4" />}
                    onClick={() => void refill()}
                  >
                    Refresh deck
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="cx-glass-card rounded-[28px] p-6 h-[440px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2 pt-4">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <SwipeDeck
            people={deckPeople}
            onLike={(person) => handleSwipe(person, 'like')}
            onPass={(person) => handleSwipe(person, 'pass')}
            onDetail={(person) =>
              setProfileTarget({ userId: person.id, name: person.name })
            }
          />
          <div className="flex items-center justify-between text-xs text-[var(--cx-text-3)] pt-2 px-1">
            <span className="font-medium">{remaining} profiles remaining</span>
            {cursor != null ? (
              <Button
                variant="ghost"
                size="sm"
                loading={loadingMore}
                icon={<RefreshCw className="size-3.5" />}
                onClick={() => void refill()}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            ) : null}
          </div>
          {loadError ? <ErrorState onRetry={() => void refill()} /> : null}
        </div>
      )}

      {profileTarget ? (
        <MemberProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setProfileTarget(null)
          }}
          userId={profileTarget.userId}
          peerName={profileTarget.name}
        />
      ) : null}
    </div>
  )
}
