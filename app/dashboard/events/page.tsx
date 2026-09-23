'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Chip, EmptyState, Input, Skeleton } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { CalendarDays, Plus, Search, Sparkles, X } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { getHostedEventsAction } from '@/app/actions/hosted-events'
import { EventCard, hostedEventToItem } from '@/components/events'
import { generateEventIcs } from '@/lib/calendar'
import { downloadTextFile } from '@/client/api/events'
import { showSuccessToast } from '@/lib/toast'

export default function EventsPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [eventsKey] = useState(() => keys.events().join('/'))
  const { data, isLoading, error, refetch } = useQuery(eventsKey, () =>
    getHostedEventsAction(),
  )
  const events = useMemo(() => data ?? [], [data])

  // Extract category search filter pills with counts
  const categoryPills = useMemo(() => {
    const counts = new Map<string, number>()

    // Standard preset categories
    const presetCategories = ['Upcoming', 'Hosted by you', 'Workshop', 'Coffee', 'Build Night', 'Social']
    presetCategories.forEach((cat) => counts.set(cat, 0))

    events.forEach((e) => {
      if (new Date(e.starts_at) >= new Date()) {
        counts.set('Upcoming', (counts.get('Upcoming') ?? 0) + 1)
      }
      counts.set('Hosted by you', (counts.get('Hosted by you') ?? 0) + 1)

      const cat = e.category || e.format || 'Social'
      const formatted = cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')
      counts.set(formatted, (counts.get(formatted) ?? 0) + 1)
    })

    return Array.from(counts.entries())
      .filter(([name, count]) => count > 0 || presetCategories.includes(name))
      .map(([name, count]) => ({ name, count }))
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Category filter logic
      let matchesCategory = true
      if (selectedCategory === 'upcoming') {
        matchesCategory = new Date(e.starts_at) >= new Date()
      } else if (selectedCategory === 'hosted by you') {
        matchesCategory = true
      } else if (selectedCategory !== 'all') {
        const cat = (e.category || e.format || '').toLowerCase().replace('_', ' ')
        matchesCategory = cat.includes(selectedCategory.toLowerCase())
      }

      if (!matchesCategory) return false
      if (!searchQuery.trim()) return true

      const q = searchQuery.toLowerCase().trim()
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location_or_link && e.location_or_link.toLowerCase().includes(q)) ||
        (e.format && e.format.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
      )
    })
  }, [events, selectedCategory, searchQuery])

  const clearFilters = () => {
    setSelectedCategory('all')
    setSearchQuery('')
  }

  const handleExportIcs = (eventData: (typeof events)[number]) => {
    const item = hostedEventToItem(eventData)
    const ics = generateEventIcs({
      id: eventData.id,
      title: eventData.title,
      description: item.description ?? '',
      location: eventData.location_or_link ?? 'Online',
      startsAt: eventData.starts_at,
      durationMinutes: 60,
    })
    downloadTextFile(`${eventData.id}.ics`, ics, 'text/calendar')
    showSuccessToast('Calendar invite (.ics) downloaded!')
  }

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
                {events.length} {events.length === 1 ? 'gathering' : 'gatherings'}
              </Badge>
              <Link href={ROUTES.eventsNew}>
                <Button icon={<Plus className="size-4" />}>New event</Button>
              </Link>
            </div>
          }
        />

        {/* Category Search & Filter Pills */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search gatherings by title, location, or format…"
                aria-label="Search gatherings"
                className="pl-9 pr-8"
              />
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cx-text-4)]" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cx-text-4)] hover:text-[var(--cx-text-1)]"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {(selectedCategory !== 'all' || searchQuery.trim() !== '') && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          <div
            data-horizontal-scroll
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            <Chip
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className="cursor-pointer transition-all duration-200 hover:scale-105"
            >
              All gatherings ({events.length})
            </Chip>
            {categoryPills.map(({ name, count }) => (
              <Chip
                key={name}
                active={selectedCategory.toLowerCase() === name.toLowerCase()}
                onClick={() => setSelectedCategory(name.toLowerCase())}
                className="cursor-pointer transition-all duration-200 hover:scale-105"
              >
                {name} ({count})
              </Chip>
            ))}
          </div>
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
              icon={<CalendarDays className="size-8 text-[var(--cx-brand)]" />}
              title={selectedCategory === 'all' && !searchQuery ? 'No events yet' : 'No matching events'}
              description={
                selectedCategory === 'all' && !searchQuery
                  ? 'Create your first gathering to bring aligned people together.'
                  : 'Try selecting a different filter pill or clearing your search to view gatherings.'
              }
              action={
                selectedCategory !== 'all' || searchQuery ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Link href={ROUTES.eventsNew}>
                    <Button icon={<Plus className="size-4" />}>
                      Host a gathering
                    </Button>
                  </Link>
                )
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
                  onExportIcs={() => handleExportIcs(e)}
                  footerAction={
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/events/${e.id}`}>
                        <Button variant="secondary" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </div>
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
