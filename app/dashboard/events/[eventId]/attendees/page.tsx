'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Download, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  SectionHeading,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  getEventAttendeesAction,
  getHostedEventAction,
  setEventAttendeeCheckedInAction,
  type EventAttendee,
} from '@/app/actions/hosted-events'
import { downloadEventAttendeesCsv } from '@/client/api/event-attendees'
import { AttendeesList, type AttendeeItem } from '@/components/events'
import { initialsForName } from '@/types/profile'
import { formatCount } from '@/utils/format-number'
import { formatMonthDay } from '@/utils/format-date'
import { keys } from '@/client/query/keys'
import { queryClient, useQuery } from '@/client/query/client'

function statusBadge(status: string): {
  label: string
  variant: 'success' | 'default' | 'danger'
} {
  switch (status) {
    case 'checked_in':
      return { label: 'Checked in', variant: 'success' }
    case 'registered':
      return { label: 'Registered', variant: 'success' }
    case 'no_show':
      return { label: 'No show', variant: 'default' }
    case 'waitlisted':
      return { label: 'Waitlisted', variant: 'default' }
    case 'cancelled':
      return { label: 'Cancelled', variant: 'danger' }
    default:
      return { label: status, variant: 'default' }
  }
}

export default function AttendeesPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const safeEventId = typeof eventId === 'string' ? eventId : ''
  const [eventKey] = useState(() =>
    [...keys.event(safeEventId), 'hosted'].join('/'),
  )
  const [attendeesKey] = useState(() =>
    [...keys.event(safeEventId), 'attendees'].join('/'),
  )
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const eventQuery = useQuery(eventKey, () =>
    getHostedEventAction({ eventId: safeEventId }),
  )
  const attendeesQuery = useQuery(attendeesKey, () =>
    getEventAttendeesAction({ eventId: safeEventId }),
  )
  const event = eventQuery.data
  const attendees = attendeesQuery.data ?? []
  const isLoading = eventQuery.isLoading || attendeesQuery.isLoading
  const error = eventQuery.error ?? attendeesQuery.error

  const attendeeItems: AttendeeItem[] = attendees.map((a) => ({
    src: a.avatarUrl ?? undefined,
    alt: a.name ?? 'Attendee',
    initials: a.name ? initialsForName(a.name) : '?',
  }))

  const toggleCheckedIn = async (row: EventAttendee, checked: boolean) => {
    setPendingId(row.id)
    setActionError(null)
    try {
      await setEventAttendeeCheckedInAction({
        registrationId: row.id,
        eventId: safeEventId,
        checked,
      })
      queryClient.invalidate(attendeesKey)
      await attendeesQuery.refetch()
    } catch {
      setActionError("Couldn't update check-in. Please try again.")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <LoadingState label="Loading attendees…" />
        ) : error || !event ? (
          <ErrorState
            onRetry={() => {
              void eventQuery.refetch()
              void attendeesQuery.refetch()
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
                {
                  label: event.title,
                  onClick: () => router.push(`/dashboard/events/${event.id}`),
                },
                { label: 'Attendees' },
              ]}
            />
            <PageHeader
              title="Attendees"
              description={`${event.title} · ${formatCount(attendees.length)} signed up`}
              actions={
                <>
                  <Link
                    href={`/dashboard/events/${event.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
                  >
                    <ArrowLeft className="size-3.5" /> Back to event
                  </Link>
                  <Button
                    variant="ghost"
                    icon={<Download className="size-4" />}
                    onClick={() => void downloadEventAttendeesCsv(event.id)}
                  >
                    Export roster
                  </Button>
                </>
              }
            />

            {attendees.length === 0 ? (
              <Card className="p-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <UsersRound className="size-8 text-[var(--cx-text-4)]" />
                  <p className="text-sm text-[var(--cx-text-3)]">
                    No one has signed up yet. Share the event page to get the
                    first RSVPs.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                <div className="mb-4">
                  <AttendeesList
                    attendees={attendeeItems}
                    capacity={event.capacity ?? undefined}
                  />
                </div>
                <SectionHeading title="Roster" className="mb-3" />
                <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead>Checked in</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendees.map((a) => {
                        const badge = statusBadge(a.status)
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">
                              {a.name ?? 'Attendee'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={badge.variant}
                                className="capitalize"
                              >
                                {badge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[var(--cx-text-3)]">
                              {formatMonthDay(a.registeredAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Switch
                                  checked={a.checkedInAt != null}
                                  disabled={pendingId === a.id}
                                  onCheckedChange={(checked) =>
                                    void toggleCheckedIn(a, checked)
                                  }
                                  aria-label={`Mark ${a.name ?? 'attendee'} as checked in`}
                                />
                                <span className="text-xs text-[var(--cx-text-4)]">
                                  {a.checkedInAt
                                    ? formatMonthDay(a.checkedInAt)
                                    : 'Not yet'}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {actionError ? (
              <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
                {actionError}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
