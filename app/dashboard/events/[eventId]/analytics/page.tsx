'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Eye, Ticket, UserCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Breadcrumb,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { getHostedEventAction } from '@/app/actions/hosted-events'
import { fetchEventAnalytics } from '@/client/api/events'
import { EventStats } from '@/components/events'
import { AnalyticsExportMenu } from '@/app/dashboard/events/_components/analytics-export-menu'
import { formatCount } from '@/utils/format-number'
import { formatEventDate } from '@/utils/format-date'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'

export default function EventAnalyticsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const safeEventId = typeof eventId === 'string' ? eventId : ''
  const [eventKey] = useState(() =>
    [...keys.event(safeEventId), 'hosted'].join('/'),
  )
  const [analyticsKey] = useState(() =>
    keys.eventAnalytics(safeEventId).join('/'),
  )
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
  const event = eventQuery.data
  const analytics = analyticsQuery.data
  const isLoading = eventQuery.isLoading || analyticsQuery.isLoading
  const error = eventQuery.error ?? analyticsQuery.error

  const stats = [
    { label: 'Views', value: formatCount(analytics?.views ?? 0), icon: Eye },
    {
      label: 'Registrations',
      value: formatCount(analytics?.registrations ?? 0),
      icon: Ticket,
    },
    {
      label: 'Check-ins',
      value: formatCount(analytics?.checkedInCount ?? 0),
      icon: UserCheck,
    },
  ]
  const bars = (analytics?.viewsByDay ?? []).slice(-7)
  const max = Math.max(1, ...bars.map((b) => b.views))
  const regBars = (analytics?.registrationsByDay ?? []).slice(-7)
  const regMax = Math.max(1, ...regBars.map((b) => b.registrations))
  const sources = analytics?.viewsBySource ?? []

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <LoadingState label="Loading analytics…" />
        ) : error || !event || !analytics ? (
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
                {
                  label: event.title,
                  onClick: () => router.push(`/dashboard/events/${event.id}`),
                },
                { label: 'Analytics' },
              ]}
            />
            <PageHeader
              title="Analytics"
              description={`${event.title} · ${formatEventDate(event.starts_at)}`}
              actions={
                <>
                  <Link
                    href={`/dashboard/events/${event.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
                  >
                    <ArrowLeft className="size-3.5" /> Back to event
                  </Link>
                  <AnalyticsExportMenu eventId={event.id} />
                </>
              }
            />

            <EventStats rows={stats} />

            <Card className="mt-3 p-5 sm:p-6">
              <p className="text-sm font-medium">Page views</p>
              <p className="mt-0.5 text-xs text-[var(--cx-text-3)]">
                Last 7 days · {formatCount(analytics.views)} total views
              </p>
              {bars.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--cx-text-3)]">
                  No views yet.
                </p>
              ) : (
                <div className="mt-6 flex h-40 items-end gap-2">
                  {bars.map((b) => (
                    <div
                      key={b.date}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-lg bg-[var(--cx-brand)]/80"
                        style={{
                          height: `${Math.round((b.views / max) * 160)}px`,
                        }}
                      />
                      <span className="text-[10px] text-[var(--cx-text-4)]">
                        {b.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="mt-3 p-5 sm:p-6">
              <p className="text-sm font-medium">Registrations by day</p>
              <p className="mt-0.5 text-xs text-[var(--cx-text-3)]">
                Last 7 days · {formatCount(analytics?.registrations ?? 0)} total
              </p>
              {regBars.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--cx-text-3)]">
                  No registrations yet.
                </p>
              ) : (
                <div className="mt-6 flex h-40 items-end gap-2">
                  {regBars.map((b) => (
                    <div
                      key={b.date}
                      className="flex flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-lg bg-[var(--cx-brand-soft)]/80"
                        style={{
                          height: `${Math.round((b.registrations / regMax) * 160)}px`,
                        }}
                      />
                      <span className="text-[10px] text-[var(--cx-text-4)]">
                        {b.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {sources.length > 0 ? (
              <Card className="mt-3 p-5 sm:p-6">
                <p className="text-sm font-medium">Views by source</p>
                <div className="mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Unique</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((s) => (
                        <TableRow key={s.source}>
                          <TableCell>
                            <Badge variant="outline">{s.source}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCount(s.views)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCount(s.uniqueViews)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
