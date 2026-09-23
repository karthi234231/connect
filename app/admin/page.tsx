'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Flag,
  Gauge,
  ScrollText,
  ShieldCheck,
  UsersRound,
  ChevronRight,
} from 'lucide-react'
import { useQuery } from '@/client/query/client'
import { fetchAdminDashboardStats } from '@/client/api/admin'
import { SectionHeading, StatusDot, StatusPill } from '@/components/ui'
import { ADMIN_PATHS, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
const modules = [
  {
    label: 'Moderation',
    description: 'Review flags, denylist, and appeals.',
    icon: ShieldCheck,
    href: ADMIN_PATHS.moderation,
  },
  {
    label: 'Reports',
    description: 'Triage inbound reports by priority.',
    icon: Flag,
    href: ADMIN_PATHS.moderation,
  },
  {
    label: 'Users',
    description: 'Search profiles, manage suspension.',
    icon: UsersRound,
    href: ADMIN_PATHS.users,
  },
  {
    label: 'Events',
    description: 'Audit events and registrations.',
    icon: CalendarDays,
    href: ADMIN_PATHS.events,
  },
  {
    label: 'Audit log',
    description: 'The latest admin and platform actions.',
    icon: ScrollText,
    href: ADMIN_PATHS.audit,
  },
] as const

function trayValue(value: number | null | undefined): string {
  // undefined = still loading; null = the read failed (render — per plan).
  if (value === undefined) return '…'
  if (value === null) return '—'
  return String(value)
}

export default function AdminPage() {
  const { data: stats } = useQuery(ADMIN_QUERY_KEYS.stats, () =>
    fetchAdminDashboardStats(),
  )

  return (
    <>
      <div className="mb-8">
        <p className="mb-1 text-xs text-[var(--cx-text-3)]">Operations</p>
        <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          Admin console
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map(({ label, description, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--cx-border-2)]"
          >
            <Icon className="size-[18px] text-[var(--cx-brand-strong)]" />
            <h2 className="mt-4 text-sm font-medium">{label}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--cx-text-3)]">
              {description}
            </p>
            <span className="mt-4 flex items-center gap-1 text-[10px] font-medium text-[var(--cx-text-3)] group-hover:text-[var(--cx-brand-strong)]">
              Open <ChevronRight className="size-3" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <SectionHeading
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-[var(--cx-brand-strong)]" />
              Moderation queue
              <StatusDot tone="brand" pulse size="sm" />
            </span>
          }
        />
        <div className="mt-4 space-y-2 text-xs text-[var(--cx-text-3)]">
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-3 py-2.5">
            <span>Open reports</span>
            <StatusPill
              label={trayValue(stats?.openReports)}
              tone={stats?.openReports ? 'danger' : 'neutral'}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-3 py-2.5">
            <span>Reports this week</span>
            <span>{trayValue(stats?.flaggedThisWeek)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-3 py-2.5">
            <span>Suspended accounts</span>
            <span>{trayValue(stats?.suspendedUsers)}</span>
          </div>
        </div>
      </div>
    </>
  )
}
