'use client'

import { useCallback, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { fetchPublicEvents, type PublicEventCard } from '@/client/api/events'
import { PageHeader } from '@/components/layout/PageHeader'
import { EventQuickView } from '@/components/events'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardTitle,
  EmptyState,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'

function capitalize(value: string) {
  if (!value) return 'community'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Date to be announced'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function EventCategoryPage() {
  const params = useParams<{ category: string }>()
  const category = typeof params?.category === 'string' ? params.category : ''
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const key = keys.search(category).join('/')
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchPublicEvents({ category, upcoming: true, limit: 30 }),
  )

  const events: PublicEventCard[] = data?.events ?? []

  const handleQuickViewChange = useCallback((open: boolean) => {
    if (!open) setSelectedEventId(null)
  }, [])

  return (
    <div className="cx-page-enter">
      <PageHeader
        eyebrow={category}
        title={`${capitalize(category)} events`}
        description="Events we've queued up for this category — explore and register."
      />

      {isLoading ? (
        <LoadingState label="Loading events…" />
      ) : error && !data ? (
        <ErrorState
          title="Couldn't load events"
          description="We hit a snag loading events. Please try again."
          onRetry={() => void refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title={`No ${category} events yet`}
          description="New gatherings appear here as hosts publish them. Check back soon."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <Card key={event.id} className="flex flex-col p-5">
                <CardContent className="flex flex-1 flex-col p-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="brand">{event.type}</Badge>
                    <Badge variant="outline">{event.format}</Badge>
                  </div>
                  <CardTitle className="mt-3 text-base">
                    {event.title}
                  </CardTitle>
                  <div className="mt-3 space-y-2 text-sm text-[var(--cx-text-3)]">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                      {formatDate(event.startsAt)}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                      {event.locationOrLink || 'Online'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--cx-border-1)] pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      Details <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <EventQuickView
            eventId={selectedEventId}
            onOpenChange={handleQuickViewChange}
          />
        </>
      )}
    </div>
  )
}
