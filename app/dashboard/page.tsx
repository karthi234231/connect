'use client'

import Link from 'next/link'
import {
  MessageCircle,
  Sparkles,
  Ticket,
  UsersRound,
  ChevronRight,
} from 'lucide-react'

import { useState } from 'react'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchMatches } from '@/client/api/matches'
import { fetchThreads } from '@/client/api/chat'
import { getHostedEventsAction } from '@/app/actions/hosted-events'
import { StatCard } from '@/components/ui'

export default function DashboardPage() {
  const [matchesKey] = useState(() => keys.matches().join('/'))
  const [threadsKey] = useState(() => keys.threads().join('/'))
  const [eventsKey] = useState(() => keys.events().join('/'))
  const matchesQuery = useQuery(matchesKey, () => fetchMatches())
  const threadsQuery = useQuery(threadsKey, () => fetchThreads())
  const eventsQuery = useQuery(eventsKey, () => getHostedEventsAction())

  const matchCount = (matchesQuery.data ?? []).length
  const unread = (threadsQuery.data ?? []).reduce(
    (sum, t) => sum + (t.unread ?? 0),
    0,
  )
  const eventCount = (eventsQuery.data ?? []).length
  const firstMatch = (matchesQuery.data ?? [])[0]
  const upcoming = (eventsQuery.data ?? []).slice(0, 3)

  const stats = [
    {
      label: 'New matches',
      value: String(matchCount),
      icon: UsersRound,
      tone: 'brand' as const,
    },
    {
      label: 'Unread messages',
      value: String(unread),
      icon: MessageCircle,
      tone: 'default' as const,
    },
    {
      label: 'Events this month',
      value: String(eventCount),
      icon: Ticket,
      tone: 'default' as const,
    },
  ]

  const nudge =
    firstMatch != null
      ? `${firstMatch.otherUser.fullName}${typeof firstMatch.matchReason === 'string' && firstMatch.matchReason.length > 0 ? ` — ${firstMatch.matchReason}` : ''}`
      : 'No matches yet — complete onboarding to meet aligned people.'

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs text-[var(--cx-text-3)]">
              Your week at a glance
            </p>
            <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
              Your dashboard
            </h1>
          </div>
          <Link
            href="/dashboard/chat"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--cx-brand)] px-4 text-sm font-medium text-white shadow-[0_10px_28px_rgba(208,164,91,.22)] transition hover:-translate-y-0.5 hover:bg-[var(--cx-brand-strong)]"
          >
            Open Chat <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              icon={<Icon className="size-[18px]" />}
              tone={tone}
            />
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_310px]">
          <div className="relative overflow-hidden rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[var(--cx-brand)] opacity-10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--cx-brand-strong)]">
                <Sparkles className="size-3.5" /> A thoughtful nudge
              </div>
              <h2 className="max-w-md font-display text-xl font-medium leading-snug tracking-[-.025em] sm:text-2xl">
                {nudge}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--cx-text-3)]">
                A conversation might be worth making space for this week.
              </p>
              {firstMatch != null ? (
                <Link
                  href={`/dashboard/chat/${firstMatch.matchId}`}
                  className="mt-5 flex items-center gap-1 text-sm font-medium hover:text-[var(--cx-brand-strong)]"
                >
                  View the connection <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
          <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Upcoming events</p>
              <Link
                href="/dashboard/notifications"
                className="text-xs font-medium hover:text-[var(--cx-brand-strong)]"
              >
                View all
              </Link>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-3 py-2.5 text-xs text-[var(--cx-text-3)]">
              <span>Upcoming</span>
              <span className="rounded-full bg-[var(--cx-brand-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--cx-brand-strong)]">
                {upcoming.length} plans
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs text-[var(--cx-text-3)]">
              {upcoming.length === 0 ? (
                <p>No upcoming events.</p>
              ) : (
                upcoming.map((e) => (
                  <p key={e.id}>
                    ·{' '}
                    <Link
                      href={`/dashboard/events/${e.id}`}
                      className="hover:text-[var(--cx-brand-strong)]"
                    >
                      {e.title}
                    </Link>
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
