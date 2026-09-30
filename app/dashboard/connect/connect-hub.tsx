'use client'

// Connect hub — client half. Owns the tab state, the shared search field, and
// the Discover tab's swipe loop. Every tab reads/writes REAL server data:
//   Discover → performSwipe (fetchDiscoverBatchAction for refill)
//   Ideas    → ConnectIdeasTab  (validateIdeaAction / submitIdeaAction)
//   Matches  → ConnectMatchesTab (fetchMatches)
//   Requests → ConnectConnectionsTab mode="requests" (respondConnectionRequest)
//   Sent     → ConnectConnectionsTab mode="sent"     (read-only)
//
// The header mirrors the requested Connect design (brand · centred tabs ·
// profile link), but is built from the app's own tokens/components so it stays
// consistent with the rest of the dashboard.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Sparkles, UserRound } from 'lucide-react'

import { fetchDiscoverBatchAction } from '@/app/actions/discover'
import { performSwipe } from '@/client/api/matches'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { MatchModal } from '@/components/matching/match-modal'
import {
  MemberProfileDialog,
  PersonCard,
  SwipeDeck,
  personInitials,
  type Person,
} from '@/components/people'
import { Button, EmptyState, Input } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { searchPeople } from '@/client/api/search'
import { useLiveRegion } from '@/hooks/use-live-region'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { getIntentLabel } from '@/services/profiles/intent'
import { initialsForName } from '@/types/profile'
import type { ProfileSummaryDTO } from '@/lib/dto'
import type { DiscoverCandidateDTO } from '@/services/discover/candidates.service'

import styles from './connect.module.css'
import {
  CONNECT_TABS,
  connectTabLabel,
  isConnectTab,
  type ConnectTab,
  type DeckBatch,
} from './types'
import { ConnectIdeasTab } from './connect-ideas-tab'
import { ConnectMatchesTab } from './connect-matches-tab'
import { ConnectConnectionsTab } from './connect-connections-tab'

const SEARCH_DEBOUNCE_MS = 250

/** Deterministic avatar tone so a person keeps the same colour between renders. */
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

/** Project a ranked Discover candidate onto the shared Person card model. */
function candidateToPerson(candidate: DiscoverCandidateDTO): Person {
  const { profile, score, recommendation } = candidate
  const availability = profile.availability.days ?? []
  const factors = Object.entries(recommendation.factors ?? {})
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  return {
    id: profile.id,
    name: profile.fullName,
    role: getIntentLabel(profile.role) ?? profile.role,
    company: '',
    initials: initialsForName(profile.fullName || '··'),
    tone: toneForName(profile.fullName),
    note: profile.bio ?? '',
    tags: profile.skills,
    location: profile.city ?? profile.timezone ?? '',
    availability: availability.length > 0 ? availability.join(' · ') : '',
    mutuals: 0,
    experience: profile.commitmentLevel ?? '',
    interests: profile.lookingFor.roles,
    education: '',
    avatarUrl: profile.avatarUrl ?? null,
    score,
    factors,
  }
}

function toSearchPerson(result: ProfileSummaryDTO): Person {
  return {
    id: result.id,
    name: result.fullName,
    role: result.role ?? '',
    company: '',
    initials: personInitials(result.fullName),
    tone: toneForName(result.fullName),
    note: result.headline ?? result.role ?? '',
    tags: result.topSkills ?? [],
    location: '',
    availability: '',
    mutuals: 0,
    experience: '',
    interests: [],
    education: '',
    avatarUrl: result.avatarUrl,
  }
}

export function ConnectHub({ initialBatch }: { initialBatch: DeckBatch }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initial tab honours ?tab=… so nav items can deep-link into a surface.
  const [tab, setTab] = useState<ConnectTab>(() => {
    const requested = searchParams.get('tab')
    return isConnectTab(requested) ? requested : 'discover'
  })

  const [query, setQuery] = useState('')

  function selectTab(next: ConnectTab) {
    setTab(next)
    // Keep the URL shareable without a full navigation.
    router.replace(`/dashboard/connect?tab=${next}`, { scroll: false })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href="/dashboard/connect"
          className={styles.brand}
          aria-current="page"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Connect
        </Link>

        <nav className={styles.nav} aria-label="Connect sections">
          {CONNECT_TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={tab === item ? styles.activeTab : styles.tab}
              aria-current={tab === item ? 'page' : undefined}
              onClick={() => selectTab(item)}
            >
              {connectTabLabel(item)}
            </button>
          ))}
        </nav>

        <Link href="/dashboard/profile" className={styles.profile}>
          <UserRound className="size-3.5" aria-hidden="true" />
          Profile
        </Link>
      </header>

      <section className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Professional community</p>
          <h1>Connect</h1>
          <p>
            Meet aligned people, validate ideas, and grow the connections that
            matter.
          </p>
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search people</span>
          <Search className={styles.searchIcon} size={16} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, skills, roles…"
          />
        </label>
      </section>

      <div className={styles.body}>
        {query.trim() ? (
          <ConnectSearchResults query={query.trim()} />
        ) : tab === 'discover' ? (
          <ConnectDiscoverTab
            initialBatch={initialBatch}
            onSwitch={selectTab}
          />
        ) : tab === 'ideas' ? (
          <ConnectIdeasTab />
        ) : tab === 'matches' ? (
          <ConnectMatchesTab />
        ) : (
          <ConnectConnectionsTab
            mode={tab === 'requests' ? 'requests' : 'sent'}
          />
        )}
      </div>
    </main>
  )
}

/** People search across the Connect hub (title/role/skill). */
function ConnectSearchResults({ query }: { query: string }) {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const searchKey = keys.search(`connect-people:${debounced}`).join('/')
  const { data, isLoading, error } = useQuery(searchKey, () =>
    searchPeople(debounced),
  )
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
  } | null>(null)

  const results = data ?? []

  if (isLoading) return <LoadingState label="Searching people…" />
  if (error) return <ErrorState onRetry={() => undefined} />

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        <EmptyState
          icon={<Search className="size-7" />}
          title={`No people for “${debounced}”`}
          description="Try a different name, role, or skill."
        />
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((person) => (
          <PersonCard
            key={person.id}
            person={toSearchPerson(person)}
            onClick={() =>
              setProfileTarget({ userId: person.id, name: person.fullName })
            }
          />
        ))}
      </div>

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
    </>
  )
}

/** Discover tab — server-ranked swipe deck wired to performSwipe. */
function ConnectDiscoverTab({
  initialBatch,
  onSwitch,
}: {
  initialBatch: DeckBatch
  onSwitch: (tab: ConnectTab) => void
}) {
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
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
  } | null>(null)
  const [matched, setMatched] = useState<{
    name: string
    role?: string
    avatarUrl?: string | null
    initials?: string
    tone?: string
    matchId?: string | null
  } | null>(null)

  const top = items[0] ?? null
  const exhausted = items.length === 0 && cursor == null

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
    const candidate = items.find((item) => item.profile.id === person.id)
    if (!candidate) return
    setBusyId(person.id)
    try {
      const result = await performSwipe(
        candidate.profile.id,
        action,
        candidate.recommendation.recommendationId,
        crypto.randomUUID(),
      )
      setItems((current) =>
        current.filter((item) => item.profile.id !== person.id),
      )
      if (result.matchCreated) {
        setMatched({
          name: candidate.profile.fullName,
          role:
            getIntentLabel(candidate.profile.role) ?? candidate.profile.role,
          avatarUrl: candidate.profile.avatarUrl,
          initials: initialsForName(candidate.profile.fullName || '··'),
          tone: toneForName(candidate.profile.fullName),
          matchId: result.matchId ?? null,
        })
        showSuccessToast(`You matched with ${candidate.profile.fullName}!`)
        announce(`You matched with ${candidate.profile.fullName}`)
      } else {
        announce(action === 'like' ? 'Connected. Next person.' : 'Passed.')
      }
      if (items.length <= 2) await refill()
    } catch {
      showErrorToast('That swipe could not be saved. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (top == null) {
    return (
      <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        {loadingMore ? (
          <LoadingState label="Loading profiles…" />
        ) : loadError ? (
          <ErrorState onRetry={() => void refill()} />
        ) : (
          <EmptyState
            icon={<Sparkles className="size-7 text-[var(--cx-brand)]" />}
            title={exhausted ? 'All caught up!' : 'No profiles to show'}
            description="You've reviewed everyone aligned with you right now. Check back later, or explore ideas instead."
            action={
              <Button size="sm" onClick={() => onSwitch('ideas')}>
                Explore ideas
              </Button>
            }
          />
        )}
      </div>
    )
  }

  const deckPeople = items.map(candidateToPerson)

  return (
    <div className={styles.deck}>
      <SwipeDeck
        people={deckPeople}
        onLike={(p) => handleSwipe(p, 'like')}
        onPass={(p) => handleSwipe(p, 'pass')}
        onDetail={(p) => setProfileTarget({ userId: p.id, name: p.name })}
        liked={busyId ? [busyId] : undefined}
      />
      <p className="mt-3 text-center text-[10px] text-[var(--cx-text-4)]">
        {items.length} profile{items.length === 1 ? '' : 's'} in your deck
      </p>

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

      {matched ? (
        <MatchModal
          open
          onClose={() => setMatched(null)}
          matchedName={matched.name}
          matchedRole={matched.role}
          matchedAvatarUrl={matched.avatarUrl}
          matchedInitials={matched.initials}
          matchedTone={matched.tone}
          matchId={matched.matchId}
        />
      ) : null}
    </div>
  )
}
