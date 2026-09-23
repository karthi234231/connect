'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, EmptyState } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { CalendarDays, Plus } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { getHostedEventsAction } from '@/app/actions/hosted-events'
import { EventCard, hostedEventToItem } from '@/components/events'

export default function EventsPage() {
  const router = useRouter()
  const [eventsKey] = useState(() => keys.events().join('/'))
  const { data, isLoading, error, refetch } = useQuery(eventsKey, () =>
    getHostedEventsAction(),
  )
  const events = data ?? []

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Your events"
          description="Gatherings you're hosting."
          actions={
            <Link href={ROUTES.eventsNew}>
              <Button icon={<Plus className="size-4" />}>New event</Button>
            </Link>
          }
        />

        {isLoading ? (
          <LoadingState label="Loading events…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-8" />}
            title="No events yet"
            description="Create your first gathering to get started."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard
                key={e.id}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
