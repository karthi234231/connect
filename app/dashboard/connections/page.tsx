'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MessageCircle, Search, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import {
  MemberProfileDialog,
  PersonCard,
  PersonSearch,
  personInitials,
  type Person,
} from '@/components/people'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { keys } from '@/client/query/keys'
import { queryClient, useQuery } from '@/client/query/client'
import {
  fetchConnections,
  respondToConnectionRequest,
} from '@/client/api/connections'
import { searchPeople } from '@/client/api/search'
import { getRelationshipStateAction } from '@/app/actions/relationship-momentum'
import { chatThreadPath } from '@/config/routes'
import type { ProfileSummaryDTO } from '@/lib/dto'
import { initialsForName } from '@/types/profile'
import { momentumPresentation } from './momentum'

const IDLE_SEARCH_KEY = 'people-search:idle'
const SEARCH_DEBOUNCE_MS = 250

function MomentumStatus({ matchId }: { matchId: string }) {
  // keys.ts is read-only; inline cache key mirrors the feed key pattern.
  const momentumKey = ['connections', matchId, 'momentum'].join('/')
  const { data, isLoading } = useQuery(momentumKey, () =>
    getRelationshipStateAction({ matchId }),
  )

  const presentation = momentumPresentation(data?.state)

  if (isLoading || !presentation) return null

  return (
    <Chip
      className="pointer-events-none"
      active={presentation.kind === 'active'}
    >
      {presentation.label}
    </Chip>
  )
}

function toPerson(result: ProfileSummaryDTO): Person {
  return {
    id: result.id,
    name: result.fullName,
    role: result.role ?? '',
    company: '',
    initials: personInitials(result.fullName),
    tone: 'bg-[var(--cx-surface-2)]',
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

export default function ConnectionsPage() {
  const [feedKey] = useState(() => keys.connections().join('/'))
  const { data, isLoading, error, refetch } = useQuery(feedKey, () =>
    fetchConnections(),
  )
  const [actingId, setActingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
    matchId: string | null
  } | null>(null)

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => clearTimeout(timer)
  }, [query])

  const searchKey = debouncedQuery
    ? keys.search(`people:${debouncedQuery}`).join('/')
    : IDLE_SEARCH_KEY
  const {
    data: people,
    isLoading: searching,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery(
    searchKey,
    debouncedQuery
      ? () => searchPeople(debouncedQuery)
      : () => Promise.resolve([] as ProfileSummaryDTO[]),
  )
  const peopleResults = people ?? []

  async function respond(requestId: string, decision: 'accept' | 'decline') {
    setActingId(requestId)
    setActionError(null)
    try {
      await respondToConnectionRequest({ requestId, decision })
      queryClient.invalidate(feedKey)
      await refetch()
    } catch {
      setActionError('Could not update that request. Please try again.')
    } finally {
      setActingId(null)
    }
  }

  const openProfile = (
    userId: string,
    name: string,
    matchId: string | null,
  ) => {
    setProfileTarget({ userId, name, matchId })
  }

  if (isLoading) {
    return (
      <div className="cx-page-enter">
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Connections"
            description="The people worth making space for."
          />
          <LoadingState label="Loading connections…" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="cx-page-enter">
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Connections"
            description="The people worth making space for."
          />
          <ErrorState onRetry={() => void refetch()} />
        </div>
      </div>
    )
  }

  const incoming = data?.incoming ?? []
  const outgoing = data?.outgoing ?? []
  const accepted = data?.connections ?? []
  const pendingCount = incoming.length + outgoing.length

  const renderRow = (
    key: string,
    name: string,
    role: string | null,
    status: string,
    peerUserId: string | null,
    avatarUrl: string | null = null,
    matchId: string | null = null,
  ) => (
    <Card key={key} className="flex items-center gap-3 p-4">
      <button
        type="button"
        onClick={() => {
          if (peerUserId) openProfile(peerUserId, name, matchId)
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar className="bg-[var(--cx-surface-3)]">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback>{initialsForName(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium hover:underline">{name}</p>
          {role ? (
            <p className="truncate text-xs text-[var(--cx-text-3)]">{role}</p>
          ) : null}
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Chip
          className="pointer-events-none capitalize"
          active={status === 'accepted'}
        >
          {status}
        </Chip>
        {matchId ? <MomentumStatus matchId={matchId} /> : null}
        {matchId ? (
          <Link
            href={chatThreadPath(matchId)}
            aria-label={`Message ${name}`}
            className="flex size-8 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white transition hover:bg-[var(--cx-brand-strong)]"
          >
            <MessageCircle className="size-4" />
          </Link>
        ) : null}
      </div>
    </Card>
  )

  const renderRequest = (
    key: string,
    name: string,
    role: string | null,
    message: string | null,
    peerUserId: string | null,
    avatarUrl: string | null = null,
  ) => (
    <Card key={key} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (peerUserId) openProfile(peerUserId, name, null)
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar className="bg-[var(--cx-surface-3)]">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initialsForName(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium hover:underline">
              {name}
            </p>
            {role ? (
              <p className="truncate text-xs text-[var(--cx-text-3)]">{role}</p>
            ) : null}
          </div>
        </button>
      </div>
      {message ? (
        <p className="line-clamp-3 text-xs leading-5 text-[var(--cx-text-3)]">
          {message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="h-9 flex-1 text-xs"
          disabled={actingId === key}
          onClick={() => void respond(key, 'accept')}
        >
          Accept
        </Button>
        <Button
          variant="ghost"
          className="h-9 flex-1 text-xs"
          disabled={actingId === key}
          onClick={() => void respond(key, 'decline')}
        >
          Decline
        </Button>
      </div>
    </Card>
  )

  const tabContent = (tab: string) => {
    if (tab === 'accepted') {
      if (accepted.length === 0)
        return (
          <EmptyState
            icon={<UsersRound className="size-8" />}
            title="No connections here"
            description="Accepted connections will show up here."
          />
        )
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accepted.map((c) =>
            renderRow(
              c.id,
              c.fullName,
              c.role,
              'accepted',
              c.id,
              c.avatarUrl,
              c.matchId,
            ),
          )}
        </div>
      )
    }
    if (tab === 'pending') {
      if (incoming.length === 0 && outgoing.length === 0)
        return (
          <EmptyState
            icon={<UsersRound className="size-8" />}
            title="No connections here"
            description="Requests will show up here."
          />
        )
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {incoming.map((r) =>
            renderRequest(
              r.id,
              r.counterpart?.fullName ?? 'Unknown',
              r.counterpart?.role ?? null,
              r.message,
              r.counterpart?.id ?? null,
              r.counterpart?.avatarUrl ?? null,
            ),
          )}
          {outgoing.map((r) =>
            renderRow(
              r.id,
              r.counterpart?.fullName ?? 'Unknown',
              r.counterpart?.role ?? null,
              'pending',
              r.counterpart?.id ?? null,
              r.counterpart?.avatarUrl ?? null,
              null,
            ),
          )}
        </div>
      )
    }
    if (accepted.length === 0 && pendingCount === 0)
      return (
        <EmptyState
          icon={<UsersRound className="size-8" />}
          title="No connections here"
          description="Requests and accepted connections will show up here."
        />
      )
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accepted.map((c) =>
          renderRow(
            c.id,
            c.fullName,
            c.role,
            'accepted',
            c.id,
            c.avatarUrl,
            c.matchId,
          ),
        )}
        {incoming.map((r) =>
          renderRequest(
            r.id,
            r.counterpart?.fullName ?? 'Unknown',
            r.counterpart?.role ?? null,
            r.message,
            r.counterpart?.id ?? null,
            r.counterpart?.avatarUrl ?? null,
          ),
        )}
      </div>
    )
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Connections"
          description="The people worth making space for."
        />

        {actionError ? (
          <p role="alert" className="mb-3 text-xs text-[var(--cx-danger)]">
            {actionError}
          </p>
        ) : null}

        <div className="mb-4 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cx-text-4)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people by name, role, or skill…"
              aria-label="Search people"
              className="h-10 pl-9"
            />
          </div>
          <div className="mt-3">
            <PersonSearch
              query={debouncedQuery}
              onQueryChange={setQuery}
              resultsCount={debouncedQuery ? peopleResults.length : undefined}
              onClear={() => {
                setQuery('')
                setDebouncedQuery('')
              }}
              featured="People"
            />
          </div>
        </div>

        {debouncedQuery ? (
          <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4">
            {searching ? <LoadingState label="Searching people…" /> : null}
            {!searching && searchError ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-[var(--cx-text-3)]">
                  Couldn&apos;t search people. Please try again.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void refetchSearch()}
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {!searching && !searchError && peopleResults.length === 0 ? (
              <EmptyState
                icon={<Search className="size-7" />}
                title={`No people for “${debouncedQuery}”`}
                description="Try a different name, role, or skill."
              />
            ) : null}
            {peopleResults.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {peopleResults.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={toPerson(person)}
                    expanded
                    onClick={() =>
                      openProfile(person.id, person.fullName, null)
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Tabs defaultValue="all" className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="accepted">Accepted</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
            {['all', 'accepted', 'pending'].map((tab) => (
              <TabsContent key={tab} value={tab}>
                {tabContent(tab)}
              </TabsContent>
            ))}
          </Tabs>
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
