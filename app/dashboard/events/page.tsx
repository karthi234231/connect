'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Chip, EmptyState, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { getHostedEventsAction } from '@/app/actions/hosted-events'
import { EventCard, hostedEventToItem } from '@/components/events'

type EventFilter = 'all' | 'upcoming' | 'hosting'

export default function EventsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<EventFilter>('all')
  const [eventsKey] = useState(() => keys.events().join('/'))
  const { data, isLoading, error, refetch } = useQuery(eventsKey, () =>
    getHostedEventsAction(),
  )
  const events = useMemo(() => data ?? [], [data])

  const filteredEvents = useMemo(() => {
    if (filter === 'upcoming') {
      return events.filter((e) => new Date(e.starts_at) >= new Date())
    }
    return events
  }, [events, filter])

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Gatherings"
          title="Your events"
          description="Gatherings you're hosting and participating in."
          actions={
            <div className="flex items-center gap-3">
              <Badge variant="brand" pulse>
                <Sparkles className="size-3" />
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </Badge>
              <Link href={ROUTES.eventsNew}>
                <Button icon={<Plus className="size-4" />}>New event</Button>
              </Link>
            </div>
          }
        />

        {/* Filter Pills */}
        <div
          data-horizontal-scroll
          className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"
        >
          <Chip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            All gatherings ({events.length})
          </Chip>
          <Chip
            active={filter === 'upcoming'}
            onClick={() => setFilter('upcoming')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            Upcoming
          </Chip>
          <Chip
            active={filter === 'hosting'}
            onClick={() => setFilter('hosting')}
            className="cursor-pointer transition-all duration-200 hover:scale-105"
          >
            Hosted by you
          </Chip>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="cx-glass-card rounded-2xl p-4 space-y-3"
              >
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filteredEvents.length === 0 ? (
          <div className="cx-glass-card rounded-[28px] p-8 text-center">
            <EmptyState
              icon={<CalendarDays className="size-8" />}
              title={filter === 'all' ? 'No events yet' : 'No matching events'}
              description={
                filter === 'all'
                  ? 'Create your first gathering to bring aligned people together.'
                  : 'Try switching your filter to view all hosted gatherings.'
              }
              action={
                <Link href={ROUTES.eventsNew}>
                  <Button icon={<Plus className="size-4" />}>
                    Host a gathering
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((e, index) => (
              <div
                key={e.id}
                className="cx-fade-in"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <EventCard
                  event={hostedEventToItem(e)}
                  onOpen={() => router.push(`/dashboard/events/${e.id}`)}
                  footerAction={
                    <Link href={`/dashboard/events/${e.id}`}>
                      <Button variant="secondary" size="sm">
                        Manage
                      </Button>
                    </Link>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
