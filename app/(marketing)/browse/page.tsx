'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Lightbulb, MapPin } from 'lucide-react'
import { useQuery } from '@/client/query/client'
import { keys } from '@/client/query/keys'
import { fetchBrowse } from '@/client/api/browse'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { IdeaCard, ideaBriefToItem } from '@/components/ideas'
import { EventQuickView } from '@/components/events'
import { ideaPath } from '@/config/routes'

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Date to be announced'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function BrowsePage() {
  const router = useRouter()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery(
    keys.browse().join('/'),
    fetchBrowse,
  )

  const ideas = data?.ideas ?? []
  const events = data?.events ?? []

  const handleQuickViewChange = useCallback((open: boolean) => {
    if (!open) setSelectedEventId(null)
  }, [])

  return (
    <div className="cx-page-enter">
      <PageHeader
        eyebrow="Explore"
        title="Browse ideas"
        description="Ideas and gatherings from the community looking for people to build with."
      />

      {isLoading ? (
        <LoadingState label="Loading ideas…" />
      ) : error ? (
        <ErrorState
          title="Couldn't load ideas"
          description="We hit a snag loading ideas. Please try again."
          onRetry={() => void refetch()}
        />
      ) : ideas.length === 0 && events.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="size-9" />}
          title="Nothing to browse yet"
          description="Ideas and events from the community will show up here."
        />
      ) : (
        <div className="space-y-10">
          {ideas.length > 0 ? (
            <div>
              <h2 className="font-display text-lg font-medium tracking-[-.02em]">
                Ideas
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ideas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={ideaBriefToItem(idea)}
                    onJoin={(item) => router.push(ideaPath(item.id))}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {events.length > 0 ? (
            <div>
              <h2 className="font-display text-lg font-medium tracking-[-.02em]">
                Events
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <Card key={event.id} className="flex flex-col">
                    <CardHeader className="flex-1">
                      <CardTitle>{event.title}</CardTitle>
                      <CardDescription>
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5" />
                          {formatDate(event.starts_at)}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {event.location_or_link || 'Online'}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="items-center justify-between">
                      <Badge variant="outline">{event.format}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        View
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              <EventQuickView
                eventId={selectedEventId}
                onOpenChange={handleQuickViewChange}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
