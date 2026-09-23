'use client'

import { useCallback, useState } from 'react'
import { ChevronRight, Download, Search, X } from 'lucide-react'
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
  Chip,
  EmptyState,
  Input,
} from '@/components/ui'
import { AvatarGroup, type AvatarGroupItem } from '@/components/ui/avatar-group'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { generateEventIcs } from '@/lib/calendar'
import { downloadTextFile } from '@/client/api/events'
import { showSuccessToast } from '@/lib/toast'

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'Date to be announced'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const CATEGORY_PILLS = [
  'All',
  'Founders',
  'Workshop',
  'Coffee & Connect',
  'Build Night',
  'Hackathon',
  'AI & Tech',
  'Networking',
  'Design',
]

export default function EventSearchPage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const trimmed = query.trim()

  const { data, isLoading, error, refetch } = useQuery(
    keys.search(submitted).join('/'),
    submitted ? () => searchEvents(submitted) : () => Promise.resolve([]),
  )

  const executeSearch = (searchTerm: string) => {
    const textToSearch = searchTerm.trim()
    queryClient.invalidate(keys.search(textToSearch).join('/'))
    setSubmitted(textToSearch)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    executeSearch(query)
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category)
    if (category === 'All') {
      setQuery('')
      executeSearch('')
    } else {
      setQuery(category)
      executeSearch(category)
    }
  }

  const handleClear = () => {
    setQuery('')
    setSubmitted('')
    setSelectedCategory('All')
  }

  const handleQuickViewChange = useCallback((open: boolean) => {
    if (!open) setSelectedEventId(null)
  }, [])

  const handleExportIcs = (eventItem: (typeof results)[number]) => {
    const ics = generateEventIcs({
      id: eventItem.id,
      title: eventItem.title,
      description: `Community gathering for ${eventItem.title}`,
      location: eventItem.location_or_link ?? 'Online',
      startsAt: eventItem.starts_at ?? new Date().toISOString(),
      durationMinutes: 60,
    })
    downloadTextFile(`${eventItem.id}.ics`, ics, 'text/calendar')
    showSuccessToast('Calendar invite (.ics) downloaded!')
  }

  const results = data ?? []

  return (
    <div className="cx-page-enter max-w-[1180px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Community events"
        title="Search events"
        description="Find meetups, workshops, and founder circles near you."
      />

      {/* Search Input & Action */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “founders”, “workshop”, or “build night”…"
            aria-label="Search events"
            className="pl-9 pr-8"
          />
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cx-text-4)]" />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear query"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-4)] hover:text-[var(--cx-text-1)]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="submit" icon={<Search className="size-4" />}>
          Search
        </Button>
      </form>

      {/* Interactive Category Filter Pills */}
      <div
        data-horizontal-scroll
        className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"
      >
        {CATEGORY_PILLS.map((cat) => {
          const isActive =
            selectedCategory.toLowerCase() === cat.toLowerCase() ||
            (cat !== 'All' && query.toLowerCase().includes(cat.toLowerCase()))
          return (
            <Chip
              key={cat}
              active={isActive}
              onClick={() => handleCategorySelect(cat)}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
            >
              {cat}
            </Chip>
          )
        })}
      </div>

      {!submitted ? (
        <EmptyState
          icon={<Search className="size-9 text-[var(--cx-brand)]" />}
          title="Search community events"
          description="Click a category pill above or type a keyword to find events happening across Connect."
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
          title={`No events found for “${submitted}”`}
          description="Try selecting a different category pill, or check back soon."
          action={
            <Button variant="secondary" onClick={handleClear}>
              Clear search filter
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {results.map((event, idx) => {
            const sampleAvatars: AvatarGroupItem[] = [
              { alt: 'Alex Morgan', initials: 'AM' },
              { alt: 'Devon Zhao', initials: 'DZ' },
              { alt: 'Chris Vance', initials: 'CV' },
            ].slice(0, (idx % 3) + 2)

            return (
              <Card key={event.id} className="p-5 transition hover:border-[var(--cx-brand)]/40">
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-0">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <CardTitle className="text-lg leading-snug">{event.title}</CardTitle>
                      <p className="mt-1 text-xs text-[var(--cx-text-3)]">
                        {formatDate(event.starts_at)} ·{' '}
                        {event.location_or_link || 'Online'} · {event.format || 'Community'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand">{event.format || 'Gathering'}</Badge>
                      <Badge variant="outline">{event.timezone || 'UTC'}</Badge>
                    </div>

                    {/* Attendee Avatars Preview */}
                    <div className="flex items-center gap-2 pt-1">
                      <AvatarGroup items={sampleAvatars} size="sm" max={3} />
                      <span className="text-[11px] text-[var(--cx-text-3)]">
                        Attending with network members
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-center shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Download className="size-3.5" />}
                      onClick={() => handleExportIcs(event)}
                      title="Export .ics calendar invite"
                      aria-label={`Export calendar invite for ${event.title}`}
                    >
                      .ics
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      Details <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <EventQuickView
            eventId={selectedEventId}
            onOpenChange={handleQuickViewChange}
          />
        </div>
      )}
    </div>
  )
}
