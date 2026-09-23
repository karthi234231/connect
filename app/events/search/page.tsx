'use client'

import { useCallback, useState } from 'react'
import { ChevronRight, Download, Search, X } from 'lucide-react'
import { queryClient, useQuery } from '@/client/query/client'
import { keys } from '@/client/query/keys'
import { searchEvents } from '@/client/api/search'
import { PageHeader } from '@/components/layout/PageHeader'
import { EventCard, EventQuickView, publicEventToItem } from '@/components/events'
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Input,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { generateEventIcs } from '@/lib/calendar'
import { downloadTextFile } from '@/client/api/events'
import { showSuccessToast } from '@/lib/toast'

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
        title="Search gatherings"
        description="Find meetups, workshops, and founder circles near you."
      />

      {/* Search Input & Action */}
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “founders”, “workshop”, or “build night”…"
            aria-label="Search gatherings"
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
          title="Search community gatherings"
          description="Click a category pill above or type a keyword to find events happening across Connect."
        />
      ) : error && !data ? (
        <ErrorState
          title="Couldn't search gatherings"
          description="We hit a snag searching. Please try again."
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <LoadingState label={`Searching for “${submitted}”…`} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-9" />}
          title={`No gatherings found for “${submitted}”`}
          description="Try selecting a different category pill, or check back soon."
          action={
            <Button variant="secondary" onClick={handleClear}>
              Clear search filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((event) => {
            const item = publicEventToItem({
              id: event.id,
              title: event.title,
              startsAt: event.starts_at ?? new Date().toISOString(),
              locationOrLink: event.location_or_link,
              type: 'virtual',
              format: event.format ?? 'Social',
              durationMinutes: 60,
              attendeeCount: 0,
              capacity: 50,
              tags: [event.format || 'Gathering'],
            })


            return (
              <EventCard
                key={event.id}
                event={item}
                onOpen={() => setSelectedEventId(event.id)}
                onExportIcs={() => handleExportIcs(event)}
                footerAction={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    Details <ChevronRight className="size-3.5" />
                  </Button>
                }
              />
            )
          })}
        </div>
      )}

      <EventQuickView
        eventId={selectedEventId}
        onOpenChange={handleQuickViewChange}
      />
    </div>
  )
}
