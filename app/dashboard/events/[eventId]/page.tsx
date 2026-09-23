'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  CalendarDays,
  Copy,
  ExternalLink,
  MapPin,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Breadcrumb, Button, Card, CardContent } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  getEventAttendeesAction,
  getHostedEventAction,
} from '@/app/actions/hosted-events'
import {
  AttendeesList,
  EventStats,
  type AttendeeItem,
} from '@/components/events'
import { fetchEventAnalytics } from '@/client/api/events'
import { AnalyticsExportMenu } from '@/app/dashboard/events/_components/analytics-export-menu'
import { formatEventDate } from '@/utils/format-date'
import { formatCount } from '@/utils/format-number'
import { initialsForName } from '@/types/profile'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'

export default function ManageEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const safeEventId = typeof eventId === 'string' ? eventId : ''
  const [eventKey] = useState(() =>
    [...keys.event(safeEventId), 'hosted'].join('/'),
  )
  const [analyticsKey] = useState(() =>
    keys.eventAnalytics(safeEventId).join('/'),
  )
  const [attendeesKey] = useState(() =>
    [...keys.event(safeEventId), 'attendees'].join('/'),
  )
  const [copied, setCopied] = useState(false)
  const eventQuery = useQuery(eventKey, () =>
    getHostedEventAction({ eventId: safeEventId }),
  )
  const analyticsQuery = useQuery(analyticsKey, () => {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 30)
    return fetchEventAnalytics(safeEventId, {
      from: from.toISOString(),
      to: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    })
  })
  const attendeesQuery = useQuery(attendeesKey, () =>
    getEventAttendeesAction({ eventId: safeEventId }),
  )
  const event = eventQuery.data
  const analytics = analyticsQuery.data
  const attendees = attendeesQuery.data ?? []
  const isLoading = eventQuery.isLoading || analyticsQuery.isLoading
  const error = eventQuery.error ?? analyticsQuery.error

  const attendeeItems: AttendeeItem[] = attendees.map((a) => ({
    src: a.avatarUrl ?? undefined,
    alt: a.name ?? 'Attendee',
    initials: a.name ? initialsForName(a.name) : '?',
  }))

  const copyRsvpLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/events/${safeEventId}`,
      )
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (non-secure context); button stays quiet.
    }
  }

  const stats = [
    {
      label: 'Attendees',
      value: formatCount(analytics?.registrations ?? 0),
      icon: UsersRound,
    },
    {
      label: 'Capacity',
      value: event?.capacity != null ? formatCount(event.capacity) : '—',
      icon: Ticket,
    },
    {
      label: 'Check-ins',
      value: formatCount(analytics?.checkedInCount ?? 0),
      icon: CalendarDays,
    },
  ]

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <LoadingState label="Loading event…" />
        ) : error || !event ? (
          <ErrorState
            onRetry={() => {
              void eventQuery.refetch()
              void analyticsQuery.refetch()
            }}
          />
        ) : (
          <>
            <Breadcrumb
              className="mb-5"
              items={[
                {
                  label: 'Events',
                  onClick: () => router.push('/dashboard/events'),
                },
                { label: event.title },
              ]}
            />
            <PageHeader
              title={event.title}
              description={formatEventDate(event.starts_at)}
              actions={
                <>
                  <Link href={`/dashboard/events/${event.id}/edit`}>
                    <Button variant="ghost">Edit</Button>
                  </Link>
                  <Link href={`/dashboard/events/${event.id}/analytics`}>
                    <Button variant="ghost">Analytics</Button>
                  </Link>
                  <Link href={`/dashboard/events/${event.id}/attendees`}>
                    <Button>Attendees</Button>
                  </Link>
                </>
              }
            />

            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="success">Live</Badge>
                  <span className="text-xs text-[var(--cx-text-4)]">
                    You're the organizer
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/events/${event.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink className="size-4" />}
                    >
                      View public page
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="size-4" />}
                    onClick={() => void copyRsvpLink()}
                  >
                    {copied ? 'Link copied' : 'Copy RSVP link'}
                  </Button>
                  <AnalyticsExportMenu eventId={event.id} />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--cx-text-2)]">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-[var(--cx-text-3)]" />{' '}
                    {formatEventDate(event.starts_at)}
                  </span>
                  {event.location_or_link ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 text-[var(--cx-text-3)]" />{' '}
                      {event.location_or_link}
                    </span>
                  ) : null}
                  {analytics ? (
                    <span className="flex items-center gap-1.5">
                      <UsersRound className="size-4 text-[var(--cx-text-3)]" />{' '}
                      {formatCount(analytics.registrations)} attending
                    </span>
                  ) : null}
                </div>
                {attendees.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--cx-border-1)] pt-4">
                    <AttendeesList
                      attendees={attendeeItems}
                      capacity={event.capacity ?? undefined}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="mt-3">
              <EventStats rows={stats} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
