'use client'

import { useState } from 'react'
import {
  Activity,
  Sparkles,
  UsersRound,
  Ticket,
  MessageCircle,
  HeartHandshake,
  type LucideIcon,
} from 'lucide-react'
import { LoadingState } from '@/components/states/LoadingState'
import { ErrorState } from '@/components/states/ErrorState'
import { StatCard } from '@/components/ui'
import { useQuery } from '@/client/query/client'
import {
  fetchTractionMetrics,
  type TractionMetrics,
} from '@/client/api/traction'

const TRACTION_QUERY_KEY = 'traction/metrics'

/** undefined = still loading; null = the read failed (render '—'). */
function metricValue(value: number | null | undefined): string {
  if (value === undefined) return '…'
  if (value === null) return '—'
  return value.toLocaleString()
}

function buildMetrics(data: TractionMetrics | undefined): Array<{
  label: string
  value: number | null | undefined
  icon: LucideIcon
}> {
  return [
    {
      label: 'Registered users',
      value: data?.registeredUsers,
      icon: UsersRound,
    },
    { label: 'Matches made', value: data?.matchesMade, icon: HeartHandshake },
    { label: 'Events hosted', value: data?.eventsHosted, icon: Ticket },
    { label: 'Messages sent', value: data?.messagesSent, icon: MessageCircle },
  ]
}

export default function TractionPage() {
  const [metricsKey] = useState(TRACTION_QUERY_KEY)
  const { data, isLoading, error, refetch } = useQuery(metricsKey, () =>
    fetchTractionMetrics(),
  )

  const metrics = buildMetrics(data)

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs text-[var(--cx-text-3)]">Connect</p>
            <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
              Traction
            </h1>
            <p className="mt-1 text-sm text-[var(--cx-text-3)]">
              Growth across the network, all time.
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-1.5 text-[11px] text-[var(--cx-text-3)] sm:flex">
            <Activity className="size-3.5 text-[var(--cx-success)]" /> Live
          </span>
        </div>

        {isLoading ? (
          <LoadingState label="Loading traction…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <StatCard
                key={label}
                label={label}
                value={metricValue(value)}
                icon={<Icon className="size-[18px]" />}
              />
            ))}
          </div>
        )}

        <div className="mt-6 rounded-[20px] border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--cx-brand-strong)]">
            <Sparkles className="size-3.5" /> All-time totals
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cx-text-3)]">
            Counts come straight from stored rows. Per-period trends and deltas
            are not tracked yet, so none are shown — a value of “—” means that
            count could not be read.
          </p>
        </div>
      </div>
    </div>
  )
}
