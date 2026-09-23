'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Search } from 'lucide-react'
import { fetchPublicEvents, type PublicEventCard } from '@/client/api/events'
import { PageHeader } from '@/components/layout/PageHeader'
import { EventCard, publicEventToItem } from '@/components/events'
import { Button, EmptyState } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'

const PAGE_SIZE = 12

export default function EventsIndexPage() {
  const router = useRouter()
  const [events, setEvents] = useState<PublicEventCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const loadPage = async (cursorOpt: string | null, full: boolean) => {
    if (busyRef.current && !full) return
    busyRef.current = true
    if (full) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const page = await fetchPublicEvents({
        upcoming: true,
        limit: PAGE_SIZE,
        cursor: cursorOpt ?? undefined,
      })
      setEvents((prev) => (cursorOpt ? [...prev, ...page.events] : page.events))
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setError(null)
    } catch {
      setError('We hit a snag loading events. Please try again.')
    } finally {
      busyRef.current = false
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Initial load. The async IIFE keeps the first setState after an await so no
    // state is written synchronously inside the effect body.
    void (async () => {
      await loadPage(null, false)
    })()
  }, [])

  return (
    <div className="cx-page-enter">
      <PageHeader
        eyebrow="Community events"
        title="Upcoming events"
        description="Meetups, workshops, and founder circles across Connect."
        actions={
          <Link href="/events/search">
            <Button variant="secondary" icon={<Search className="size-4" />}>
              Search events
            </Button>
          </Link>
        }
      />

      {isLoading && events.length === 0 ? (
        <LoadingState label="Loading events…" />
      ) : error && events.length === 0 ? (
        <ErrorState
          title="Couldn't load events"
          description={error}
          onRetry={() => void loadPage(null, true)}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title="No events yet"
          description="New gatherings appear here as hosts publish them. Check back soon."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={publicEventToItem(event)}
                onOpen={() => router.push(`/events/${event.id}`)}
                onRegister={() => router.push(`/events/${event.id}`)}
              />
            ))}
          </div>

          {error ? (
            <p className="mt-4 text-center text-xs text-[var(--cx-danger)]">
              {error}
            </p>
          ) : null}

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void loadPage(cursor, false)}
                disabled={isLoading || !cursor}
              >
                {isLoading ? 'Loading…' : 'Load more events'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
