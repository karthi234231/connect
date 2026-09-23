'use client'

// Interactive swipe deck: deck state, refill via the opaque cursor contract,
// filter drawer controls, undo last pass, and swipe submission with a per-gesture idempotency key.
import { useCallback, useMemo, useState } from 'react'
import { RefreshCw, RotateCcw, SlidersHorizontal, Sparkles, UserCheck, X } from 'lucide-react'

import { fetchDiscoverBatchAction } from '@/app/actions/discover'
import { performSwipe } from '@/client/api/matches'
import { ErrorState } from '@/components/states/ErrorState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MatchModal } from '@/components/matching/match-modal'
import {
  DiscoverFilterDrawer,
  DEFAULT_DISCOVER_FILTERS,
  MemberProfileDialog,
  ROLE_OPTIONS,
  WORK_STYLE_OPTIONS,
  SwipeDeck,
  type DiscoverFilterState,
  type Person,
} from '@/components/people'
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui'
import { useLiveRegion } from '@/hooks/use-live-region'
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toast'
import type { MatchFiltersInput } from '@/services/matching/filters.schema'
import type {
  DiscoverBatch,
  DiscoverCandidateDTO,
} from '@/services/discover/candidates.service'
import { getIntentLabel } from '@/services/profiles/intent'
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

  const offeringLabels = (profile.offering?.categories ?? [])
    .map((cat) => getIntentLabel(cat) ?? cat)
    .filter((v, i, a) => a.indexOf(v) === i)

  const lookingForLabels = (profile.lookingFor?.roles ?? [])
    .map((role) => getIntentLabel(role) ?? role)
    .filter((v, i, a) => a.indexOf(v) === i)

  const intentBadges: { label: string; type: 'offering' | 'lookingFor' }[] = [
    ...offeringLabels.map((l) => ({ label: l, type: 'offering' as const })),
    ...lookingForLabels.map((l) => ({ label: l, type: 'lookingFor' as const })),
  ]

  return {
    id: profile.id,
    name: profile.fullName,
    role: getIntentLabel(profile.role) ?? profile.role,
    company: '',
    initials: initialsForName(profile.fullName || '··'),
    tone: toneForName(profile.fullName),
    note: profile.bio ?? '',
    tags: profile.skills, // skills offered
    offering: offeringLabels.length > 0 ? offeringLabels : profile.skills,
    lookingFor: lookingForLabels,
    intentBadges,
    location: profile.city ?? profile.timezone ?? '',
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
  const [passedStack, setPassedStack] = useState<DiscoverCandidateDTO[]>([])
  const [filters, setFilters] = useState<DiscoverFilterState>(
    DEFAULT_DISCOVER_FILTERS,
  )
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [cursor, setCursor] = useState<string | null>(
    () => initialBatch.nextCursorToken,
  )
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matchedState, setMatchedState] = useState<{
    matchedName: string
    matchedRole?: string
    matchedAvatarUrl?: string | null
    matchedInitials?: string
    matchedTone?: string
    matchId?: string | null
  } | null>(null)
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
  } | null>(null)

  const activeFilterCount = useMemo(() => {
    return (
      filters.intents.length +
      (filters.role ? 1 : 0) +
      (filters.region ? 1 : 0) +
      (filters.workStyle ? 1 : 0)
    )
  }, [filters])

  const getRoleLabel = useCallback((roleValue: string) => {
    const found = ROLE_OPTIONS.find((r: { value: string; label: string }) => r.value === roleValue)
    return found ? found.label : roleValue
  }, [])

  const getWorkStyleLabel = useCallback((styleValue: string) => {
    const found = WORK_STYLE_OPTIONS.find((w: { value: string; label: string }) => w.value === styleValue)
    return found ? found.label : styleValue
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Role filter
      if (filters.role && item.profile.role !== filters.role) {
        return false
      }

      // 2. Region filter
      if (filters.region) {
        const tz = item.profile.timezone || ''
        if (!tz.startsWith(`${filters.region}/`)) {
          return false
        }
      }

      // 3. WorkStyle filter
      if (filters.workStyle && item.profile.workStyle !== filters.workStyle) {
        return false
      }

      // 4. Intent filter (Co-founder, Collaborator, Advisor, Mentor)
      if (filters.intents.length > 0) {
        const personObj = toPerson(item)
        const offering = personObj.offering ?? []
        const lookingFor = personObj.lookingFor ?? []
        const matchesAnyIntent = filters.intents.some((intent) => {
          const lowerIntent = intent.toLowerCase()

          if (lowerIntent === 'co-founder') {
            return (
              personObj.role.toLowerCase().includes('founder') ||
              offering.some((o) => o.toLowerCase().includes('founder')) ||
              lookingFor.some((l) => l.toLowerCase().includes('founder')) ||
              personObj.note.toLowerCase().includes('founder') ||
              personObj.note.toLowerCase().includes('co-founder')
            )
          }

          if (lowerIntent === 'collaborator') {
            return (
              ['engineer', 'designer', 'product', 'growth', 'operations', 'data_ml'].some(
                (r) => personObj.role.toLowerCase().includes(r),
              ) ||
              offering.length > 0 ||
              personObj.note.toLowerCase().includes('collaborat') ||
              personObj.note.toLowerCase().includes('build')
            )
          }

          if (lowerIntent === 'advisor') {
            return (
              personObj.note.toLowerCase().includes('advisor') ||
              personObj.note.toLowerCase().includes('advis') ||
              personObj.tags.some((t) => t.toLowerCase().includes('advis')) ||
              personObj.experience.toLowerCase().includes('part_time')
            )
          }

          if (lowerIntent === 'mentor') {
            return (
              personObj.note.toLowerCase().includes('mentor') ||
              personObj.note.toLowerCase().includes('coach') ||
              personObj.tags.some((t) => t.toLowerCase().includes('mentor'))
            )
          }

          return false
        })

        if (!matchesAnyIntent) return false
      }

      return true
    })
  }, [items, filters])

  const top = filteredItems[0] ?? null
  const exhausted = filteredItems.length === 0 && cursor == null
  const remaining = useMemo(() => filteredItems.length, [filteredItems.length])

  const deckPeople = useMemo(() => filteredItems.map(toPerson), [filteredItems])
  const candidateById = useMemo(
    () => new Map(items.map((item) => [item.profile.id, item])),
    [items],
  )

  const buildServerFilters = useCallback(
    (filterState: DiscoverFilterState): MatchFiltersInput => {
      const result: MatchFiltersInput = { skill: undefined }
      if (filterState.role)
        result.role = filterState.role as MatchFiltersInput['role']
      if (filterState.region)
        result.region = filterState.region as MatchFiltersInput['region']
      if (filterState.workStyle)
        result.workStyle = filterState.workStyle as MatchFiltersInput['workStyle']
      return result
    },
    [],
  )

  const refill = useCallback(async () => {
    if (loadingMore || cursor == null) return
    setLoadingMore(true)
    setLoadError(false)
    try {
      const serverFilters = buildServerFilters(filters)
      const batch = (await fetchDiscoverBatchAction(
        cursor,
        serverFilters,
      )) as DeckBatch
      setItems((current) => [...current, ...batch.items])
      setCursor(batch.nextCursorToken)
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, filters, buildServerFilters])

  const handleApplyFilters = useCallback(
    async (newFilters: DiscoverFilterState) => {
      setFilters(newFilters)
      setLoadingMore(true)
      setLoadError(false)
      try {
        const serverFilters = buildServerFilters(newFilters)
        const batch = (await fetchDiscoverBatchAction(
          null,
          serverFilters,
        )) as DeckBatch
        setItems(batch.items)
        setCursor(batch.nextCursorToken)
        announce('Discover deck updated with filtered candidates.')
      } catch {
        setLoadError(true)
        showErrorToast('Failed to apply candidate filters. Please try again.')
      } finally {
        setLoadingMore(false)
      }
    },
    [announce, buildServerFilters],
  )

  const handleResetFilters = useCallback(async () => {
    setFilters(DEFAULT_DISCOVER_FILTERS)
    setLoadingMore(true)
    setLoadError(false)
    try {
      const batch = (await fetchDiscoverBatchAction(null)) as DeckBatch
      setItems(batch.items)
      setCursor(batch.nextCursorToken)
      announce('Discover filters reset.')
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [announce])

  const handleUndo = useCallback(async () => {
    if (passedStack.length === 0) return
    const lastCandidate = passedStack[passedStack.length - 1]
    if (!lastCandidate) return

    setPassedStack((prev) => prev.slice(0, -1))
    setItems((current) => [lastCandidate, ...current])
    showInfoToast(
      'Swipe undone',
      `Restored ${lastCandidate.profile.fullName} back to your deck.`,
    )
    announce(`Restored ${lastCandidate.profile.fullName} to deck.`)
  }, [passedStack, announce])

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
      if (action === 'pass') {
        setPassedStack((prev) => [...prev, candidate])
      }
      if (result.matchCreated) {
        setMatchedState({
          matchedName: candidate.profile.fullName,
          matchedRole:
            getIntentLabel(candidate.profile.role) ?? candidate.profile.role,
          matchedAvatarUrl: candidate.profile.avatarUrl,
          matchedInitials: initialsForName(candidate.profile.fullName || '··'),
          matchedTone: toneForName(candidate.profile.fullName),
          matchId: result.matchId ?? null,
        })
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<SlidersHorizontal className="size-4" />}
              onClick={() => setFilterDrawerOpen(true)}
            >
              Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Button>
            {remaining > 0 ? (
              <Badge
                variant="brand"
                pulse
                className="cx-fade-in hidden sm:inline-flex"
              >
                <Sparkles className="size-3" />
                {remaining} aligned
              </Badge>
            ) : null}
          </div>
        }
      />

      {/* Active Filters Summary Bar */}
      {activeFilterCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)]/60 px-4 py-2 text-xs">
          <span className="font-semibold text-[var(--cx-text-3)]">
            Active filters:
          </span>
          {filters.intents.map((intent) => (
            <Badge
              key={intent}
              variant="brand"
              className="cursor-pointer gap-1"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  intents: f.intents.filter((i) => i !== intent),
                }))
              }
            >
              <span>Intent: {intent}</span>
              <X className="size-3" />
            </Badge>
          ))}
          {filters.role ? (
            <Badge
              variant="brand"
              className="cursor-pointer gap-1"
              onClick={() => setFilters((f) => ({ ...f, role: null }))}
            >
              <span>Role: {getRoleLabel(filters.role)}</span>
              <X className="size-3" />
            </Badge>
          ) : null}
          {filters.region ? (
            <Badge
              variant="brand"
              className="cursor-pointer gap-1"
              onClick={() => setFilters((f) => ({ ...f, region: null }))}
            >
              <span>Region: {filters.region}</span>
              <X className="size-3" />
            </Badge>
          ) : null}
          {filters.workStyle ? (
            <Badge
              variant="brand"
              className="cursor-pointer gap-1"
              onClick={() => setFilters((f) => ({ ...f, workStyle: null }))}
            >
              <span>Style: {getWorkStyleLabel(filters.workStyle)}</span>
              <X className="size-3" />
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleResetFilters}
          >
            Clear all
          </Button>
        </div>
      ) : null}

      {matchedState ? (
        <div className="mb-6 cx-scale-up rounded-[24px] border border-[color-mix(in_srgb,var(--cx-brand)_40%,transparent)] bg-[var(--cx-surface-2)]/90 backdrop-blur-md p-5 shadow-[var(--cx-shadow-glow)]">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--cx-text-1)]">
                It&apos;s a match with {matchedState.matchedName} 🎉
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
              description="No more candidate profiles matching your current criteria — try adjusting your filters or restore your last passed candidate."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {passedStack.length > 0 ? (
                    <Button
                      variant="primary"
                      icon={<RotateCcw className="size-4" />}
                      onClick={() => void handleUndo()}
                    >
                      Undo Last Pass
                    </Button>
                  ) : null}
                  {activeFilterCount > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => void handleResetFilters()}
                    >
                      Reset filters
                    </Button>
                  ) : cursor != null ? (
                    <Button
                      variant="secondary"
                      icon={<RefreshCw className="size-4" />}
                      onClick={() => void refill()}
                    >
                      Refresh deck
                    </Button>
                  ) : null}
                </div>
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
            onUndo={handleUndo}
            canUndo={passedStack.length > 0}
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

      {matchedState ? (
        <MatchModal
          open
          onClose={() => setMatchedState(null)}
          matchedName={matchedState.matchedName}
          matchedRole={matchedState.matchedRole}
          matchedAvatarUrl={matchedState.matchedAvatarUrl}
          matchedInitials={matchedState.matchedInitials}
          matchedTone={matchedState.matchedTone}
          matchId={matchedState.matchId}
        />
      ) : null}

      <DiscoverFilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />
    </div>
  )
}
