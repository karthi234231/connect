'use client'

import { useCallback, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { queryClient, useQuery } from '@/client/query/client'
import { keys } from '@/client/query/keys'
import { searchEvents } from '@/client/api/search'
import { PageHeader } from '@/components/layout/PageHeader'
import { EventQuickView } from '@/components/events'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardTitle,
  EmptyState,
  Input,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Date to be announced'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function EventSearchPage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const trimmed = query.trim()

  const { data, isLoading, error, refetch } = useQuery(
    keys.search(submitted).join('/'),
    submitted ? () => searchEvents(submitted) : () => Promise.resolve([]),
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    queryClient.invalidate(keys.search(trimmed).join('/'))
    setSubmitted(trimmed)
  }

  const handleQuickViewChange = useCallback((open: boolean) => {
    if (!open) setSelectedEventId(null)
  }, [])

  const results = data ?? []

  return (
    <div className="cx-page-enter">
      <PageHeader
        eyebrow="Community events"
        title="Search events"
        description="Find meetups, workshops, and founder circles near you."
      />

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “founders” or “workshop”…"
          aria-label="Search events"
          className="flex-1"
        />
        <Button type="submit" icon={<Search className="size-4" />}>
          Search
        </Button>
      </form>

      {!submitted ? (
        <EmptyState
          icon={<Search className="size-9" />}
          title="Search community events"
          description="Type a keyword above to find events happening across Connect."
        />
      ) : error && !data ? (
        <ErrorState
          title="Couldn't search events"
          description="We hit a snag searching. Please try again."
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <LoadingState label={`Searching for “${submitted}”…`} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-9" />}
          title={`No events for “${submitted}”`}
          description="Try a different keyword, or check back soon."
        />
      ) : (
        <div className="space-y-3">
          {results.map((event) => (
            <Card key={event.id} className="p-5">
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  <p className="mt-1 text-sm text-[var(--cx-text-3)]">
                    {formatDate(event.starts_at)} ·{' '}
                    {event.location_or_link || 'Online'} · {event.format}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="brand">{event.format}</Badge>
                    <Badge variant="outline">{event.timezone || 'UTC'}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedEventId(event.id)}
                >
                  Details <ChevronRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}

          <EventQuickView
            eventId={selectedEventId}
            onOpenChange={handleQuickViewChange}
          />
        </div>
      )}
    </div>
  )
}
