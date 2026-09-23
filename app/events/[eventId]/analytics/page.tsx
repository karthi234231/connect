'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Eye,
  MousePointerClick,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { useQuery } from '@/client/query/client'
import { keys } from '@/client/query/keys'
import { fetchEventAnalytics } from '@/client/api/events'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, EmptyState } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'

export default function EventAnalyticsPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = typeof params?.eventId === 'string' ? params.eventId : ''

  const { data, isLoading, error, refetch } = useQuery(
    keys.eventAnalytics(eventId).join('/'),
    () => {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - 30)
      return fetchEventAnalytics(eventId, {
        from: from.toISOString(),
        to: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
    },
  )

  const tiles = data
    ? [
        { label: 'Views', value: data.views, icon: Eye },
        { label: 'Unique views', value: data.uniqueViews, icon: UsersRound },
        { label: 'Registrations', value: data.registrations, icon: Ticket },
        {
          label: 'Conversion rate',
          value: `${data.conversionRate}%`,
          icon: MousePointerClick,
        },
      ]
    : []

  const maxViews = Math.max(1, ...(data?.viewsByDay ?? []).map((d) => d.views))
  const maxRegs = Math.max(
    1,
    ...(data?.registrationsByDay ?? []).map((d) => d.registrations),
  )

  return (
    <div className="cx-page-enter">
      <Link
        href={`/events/${eventId}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
      >
        <ArrowLeft className="size-4" /> Back to event
      </Link>

      <PageHeader
        eyebrow="Analytics"
        title="Event performance"
        description="How this event is performing over the last 30 days."
      />

      {isLoading ? (
        <LoadingState label="Loading analytics…" />
      ) : error ? (
        <ErrorState
          title="Couldn't load analytics"
          description="We hit a snag loading analytics. Please try again."
          onRetry={() => void refetch()}
        />
      ) : !data ? (
        <EmptyState
          icon={<BarChart3 className="size-9" />}
          title="No analytics yet"
          description="Once the event has traffic, numbers will show up here."
        />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-5">
                <Icon className="size-[18px] text-[var(--cx-brand-strong)]" />
                <p className="mt-4 font-display text-3xl font-semibold tracking-[-.04em]">
                  {value}
                </p>
                <p className="mt-1 text-xs text-[var(--cx-text-3)]">{label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5 sm:p-6">
            <p className="text-sm font-medium">Views per day</p>
            {data.viewsByDay.length > 0 ? (
              <div className="mt-4 flex h-32 items-end gap-1">
                {data.viewsByDay.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.views}`}
                    className="flex-1 rounded-t-md bg-[var(--cx-brand)] opacity-80"
                    style={{
                      height: `${Math.max(4, Math.round((d.views / maxViews) * 100))}%`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--cx-text-3)]">
                No daily view data yet for this event.
              </p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="text-sm font-medium">Registrations per day</p>
            {data.registrationsByDay.length > 0 ? (
              <div className="mt-4 flex h-32 items-end gap-1">
                {data.registrationsByDay.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.registrations}`}
                    className="flex-1 rounded-t-md bg-[var(--cx-brand-soft)] opacity-80"
                    style={{
                      height: `${Math.max(4, Math.round((d.registrations / maxRegs) * 100))}%`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--cx-text-3)]">
                No daily registration data yet for this event.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
