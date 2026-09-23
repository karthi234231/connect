'use client'

// Interactive swipe deck: deck state, refill via the opaque cursor contract,
// and swipe submission with a per-gesture idempotency key. The generic
// SwipeDeck (components/people) presents people[0]; this module feeds it the
// ranked DiscoverCandidateDTO projection and owns every server interaction.
import { useCallback, useMemo, useState } from 'react'

import { fetchDiscoverBatchAction } from '@/app/actions/discover'
import { performSwipe } from '@/client/api/matches'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  MemberProfileDialog,
  SwipeDeck,
  type Person,
} from '@/components/people'
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
      />
      {matchedName ? (
        <div className="mb-4 rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5">
          <p className="text-sm font-medium">
            It&apos;s a match with {matchedName} 🎉
          </p>
          <p className="mt-1 text-xs text-[var(--cx-text-3)]">
            Head to Messages to say hello.
          </p>
        </div>
      ) : null}
      {top == null ? (
        loadingMore ? (
          <LoadingState label="Loading more profiles…" />
        ) : loadError ? (
          <ErrorState onRetry={() => void refill()} />
        ) : exhausted || initialBatch.version === 'invalid' ? (
          <div className="rounded-[20px] border border-dashed border-[var(--cx-border-2)] p-8 text-center text-sm text-[var(--cx-text-3)]">
            No more profiles right now — check back soon for fresh
            recommendations.
          </div>
        ) : (
          <LoadingState label="Loading profiles…" />
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
          <div className="flex items-center justify-between text-xs text-[var(--cx-text-4)]">
            <span>{remaining} in deck</span>
            {cursor != null ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void refill()}
                className="font-medium text-[var(--cx-brand-strong)] disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
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
