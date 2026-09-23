'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  Filter,
  Flag,
  Gauge,
  HardDrive,
  Layers,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserX,
  UsersRound,
  XCircle,
  Zap,
} from 'lucide-react'

import { useQuery, queryClient } from '@/client/query/client'
import {
  fetchAdminAuditLogs,
  fetchAdminDashboardStats,
  fetchAdminUsers,
  fetchReportQueue,
  fetchSystemHealth,
  resolveReport,
  reviewReport,
  suspendUser,
  unsuspendUser,
  type SystemHealthCheck,
} from '@/client/api/admin'
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  SectionHeading,
  Select,
  StatusDot,
  StatusPill,
  Tabs,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from '@/components/ui'
import { LoadingState } from '@/components/states/LoadingState'
import { ADMIN_PATHS, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
import { formatRelativeDate } from '@/utils/format-date'
import type { AdminAuditLogDTO, AdminUserRowDTO } from '@/lib/dto-admin'

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
  if (value === undefined) return '…'
  if (value === null) return '—'
  return String(value)
}

function probeStatusTone(status: SystemHealthCheck['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ok':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'neutral'
  }
}

function probeIcon(status: SystemHealthCheck['status']) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="size-4 text-[var(--cx-success)]" />
    case 'degraded':
      return <AlertTriangle className="size-4 text-[var(--cx-warning)]" />
    case 'error':
      return <XCircle className="size-4 text-[var(--cx-danger)]" />
    default:
      return <Activity className="size-4 text-[var(--cx-text-3)]" />
  }
}

function exportAuditLogsToCSV(logs: AdminAuditLogDTO[]) {
  if (!logs.length) return
  const headers = ['Log ID', 'Timestamp', 'Action', 'Actor ID', 'Entity Type', 'Entity ID']
  const csvRows = logs.map((log) => [
    log.id,
    log.createdAt,
    log.action,
    log.actorId ?? 'system',
    log.entityType ?? '',
    log.entityId ?? '',
  ])

  const csvContent = [
    headers.join(','),
    ...csvRows.map((row) =>
      row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `admin_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── SVG Metric Radial Gauge Component ─────────────────────────────
interface MetricGaugeProps {
  label: string
  percent: number // 0 to 100
  displayValue: string
  sublabel: string
  tone?: 'success' | 'warning' | 'danger' | 'info'
  icon?: React.ReactNode
}

function MetricGauge({
  label,
  percent,
  displayValue,
  sublabel,
  tone = 'success',
  icon,
}: MetricGaugeProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const radius = 38
  const circumference = 2 * Math.PI * radius // ~238.76
  const arcLength = circumference * 0.75 // 270 degree arc = 179.07
  const strokeDashoffset = arcLength - (clampedPercent / 100) * arcLength

  const strokeColors = {
    success: 'stroke-[var(--cx-success)]',
    warning: 'stroke-[var(--cx-warning)]',
    danger: 'stroke-[var(--cx-danger)]',
    info: 'stroke-[var(--cx-brand-strong)]',
  }

  const badgeTones = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'brand',
  } as const

  return (
    <div className="flex flex-col items-center justify-between rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4 text-center transition hover:border-[var(--cx-border-2)]">
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium text-[var(--cx-text-2)]">{label}</span>
        <StatusPill
          label={`${clampedPercent}%`}
          tone={badgeTones[tone]}
        />
      </div>

      <div className="relative my-3 flex items-center justify-center">
        <svg className="size-28 rotate-[135deg] transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-[var(--cx-border-1)]"
            strokeWidth="7"
            fill="none"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`transition-all duration-700 ease-out ${strokeColors[tone]}`}
            strokeWidth="7"
            fill="none"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          {icon ? <div className="mb-0.5 text-[var(--cx-text-3)]">{icon}</div> : null}
          <span className="font-display text-base font-bold tracking-tight text-[var(--cx-text-1)]">
            {displayValue}
          </span>
        </div>
      </div>

      <span className="text-[11px] text-[var(--cx-text-3)]">{sublabel}</span>
    </div>
  )
}

// ─── Match Velocity Chart Bars Component ─────────────────────────────
type VelocityTimeframe = '24h' | '7d' | '30d'

interface VelocityBucket {
  label: string
  matches: number
  accepted: number
  rate: number
  trend: string
}

const velocityDataMap: Record<VelocityTimeframe, VelocityBucket[]> = {
  '24h': [
    { label: '00:00', matches: 42, accepted: 38, rate: 90.5, trend: '+4%' },
    { label: '02:00', matches: 24, accepted: 20, rate: 83.3, trend: '-2%' },
    { label: '04:00', matches: 18, accepted: 15, rate: 83.3, trend: '-5%' },
    { label: '06:00', matches: 65, accepted: 58, rate: 89.2, trend: '+12%' },
    { label: '08:00', matches: 140, accepted: 122, rate: 87.1, trend: '+25%' },
    { label: '10:00', matches: 210, accepted: 184, rate: 87.6, trend: '+35%' },
    { label: '12:00', matches: 285, accepted: 246, rate: 86.3, trend: '+18%' },
    { label: '14:00', matches: 240, accepted: 208, rate: 86.7, trend: '+8%' },
    { label: '16:00', matches: 310, accepted: 272, rate: 87.7, trend: '+22%' },
    { label: '18:00', matches: 340, accepted: 295, rate: 86.8, trend: '+30%' },
    { label: '20:00', matches: 260, accepted: 228, rate: 87.7, trend: '+15%' },
    { label: '22:00', matches: 175, accepted: 152, rate: 86.9, trend: '+5%' },
  ],
  '7d': [
    { label: 'Mon', matches: 1420, accepted: 1240, rate: 87.3, trend: '+8%' },
    { label: 'Tue', matches: 1650, accepted: 1450, rate: 87.8, trend: '+14%' },
    { label: 'Wed', matches: 1890, accepted: 1660, rate: 87.8, trend: '+18%' },
    { label: 'Thu', matches: 1780, accepted: 1560, rate: 87.6, trend: '+12%' },
    { label: 'Fri', matches: 2240, accepted: 1980, rate: 88.4, trend: '+24%' },
    { label: 'Sat', matches: 2680, accepted: 2350, rate: 87.7, trend: '+32%' },
    { label: 'Sun', matches: 2410, accepted: 2120, rate: 88.0, trend: '+28%' },
  ],
  '30d': [
    { label: 'W1', matches: 9400, accepted: 8250, rate: 87.8, trend: '+12%' },
    { label: 'W2', matches: 10800, accepted: 9480, rate: 87.8, trend: '+16%' },
    { label: 'W3', matches: 12100, accepted: 10650, rate: 88.0, trend: '+22%' },
    { label: 'W4', matches: 13900, accepted: 12240, rate: 88.1, trend: '+28%' },
  ],
}

function MatchVelocityChart() {
  const [timeframe, setTimeframe] = useState<VelocityTimeframe>('24h')
  const [hoveredBucket, setHoveredBucket] = useState<VelocityBucket | null>(null)

  const buckets = velocityDataMap[timeframe]
  const totalMatches = buckets.reduce((sum, b) => sum + b.matches, 0)
  const totalAccepted = buckets.reduce((sum, b) => sum + b.accepted, 0)
  const avgAcceptance = (totalMatches > 0 ? (totalAccepted / totalMatches) * 100 : 0).toFixed(1)
  const peakMatches = Math.max(...buckets.map((b) => b.matches))
  const avgMatches = Math.round(totalMatches / buckets.length)

  return (
    <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeading
          title={
            <span className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[var(--cx-brand-strong)]" />
              Match Velocity Analytics
              <StatusDot tone="brand" pulse size="sm" />
            </span>
          }
        />
        <Tabs
          defaultValue="24h"
          onValueChange={(val) => setTimeframe(val as VelocityTimeframe)}
        >
          <TabsList>
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
          <span className="text-xs text-[var(--cx-text-3)]">Total Window Matches</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-xl font-bold">{totalMatches.toLocaleString()}</span>
            <Badge variant="brand">+18.4%</Badge>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
          <span className="text-xs text-[var(--cx-text-3)]">Avg Match Velocity</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-xl font-bold">{avgMatches.toLocaleString()}</span>
            <span className="text-[11px] text-[var(--cx-text-4)]">per bucket</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
          <span className="text-xs text-[var(--cx-text-3)]">Peak Velocity Bar</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-xl font-bold text-[var(--cx-brand-strong)]">
              {peakMatches.toLocaleString()}
            </span>
            <span className="text-[11px] text-[var(--cx-text-4)]">matches</span>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
          <span className="text-xs text-[var(--cx-text-3)]">Match Acceptance Rate</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-display text-xl font-bold text-[var(--cx-success)]">
              {avgAcceptance}%
            </span>
            <Badge variant="success">Optimal</Badge>
          </div>
        </div>
      </div>

      {/* Bar Chart Graphics */}
      <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--cx-text-3)]">
          <span>Match Creation Volume & Accepted Velocity</span>
          <span>
            {hoveredBucket ? (
              <span className="font-mono text-[var(--cx-brand-strong)] font-semibold">
                {hoveredBucket.label}: {hoveredBucket.matches} matches ({hoveredBucket.rate}% accepted, {hoveredBucket.trend})
              </span>
            ) : (
              'Hover over bars for velocity details'
            )}
          </span>
        </div>

        <div className="relative mt-6 flex h-48 items-end gap-2 sm:gap-3 border-b border-[var(--cx-border-1)] pb-2 px-1">
          {buckets.map((b) => {
            const heightPercent = peakMatches > 0 ? (b.matches / peakMatches) * 100 : 0
            const isHovered = hoveredBucket?.label === b.label

            return (
              <div
                key={b.label}
                className="group relative flex flex-1 flex-col items-center justify-end h-full cursor-pointer"
                onMouseEnter={() => setHoveredBucket(b)}
                onMouseLeave={() => setHoveredBucket(null)}
              >
                {/* Value Badge above bar on hover */}
                <div
                  className={`absolute -top-7 rounded bg-[var(--cx-surface-1)] border border-[var(--cx-border-2)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--cx-text-1)] shadow-sm transition-opacity ${
                    isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {b.matches}
                </div>

                {/* Primary Bar */}
                <div
                  style={{ height: `${Math.max(8, heightPercent)}%` }}
                  className={`w-full max-w-[42px] rounded-t-md transition-all duration-300 ${
                    isHovered
                      ? 'bg-[var(--cx-brand-strong)] shadow-md shadow-[var(--cx-brand-soft)] scale-105'
                      : 'bg-gradient-to-t from-[var(--cx-brand)] to-[#818cf8] opacity-85 group-hover:opacity-100'
                  }`}
                >
                  {/* Secondary Inner Accepted Fill */}
                  <div
                    style={{ height: `${b.rate}%` }}
                    className="w-full rounded-t-md bg-white/20"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="mt-2 flex justify-between px-1 text-[11px] font-mono text-[var(--cx-text-3)]">
          {buckets.map((b) => (
            <span
              key={b.label}
              className={`flex-1 text-center ${
                hoveredBucket?.label === b.label ? 'text-[var(--cx-brand-strong)] font-semibold' : ''
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

type ModerationTab = 'open' | 'reviewed' | 'actioned'

export default function AdminPage() {
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userActionId, setUserActionId] = useState<string | null>(null)
  const [userActionError, setUserActionError] = useState<string | null>(null)

  const [moderationTab, setModerationTab] = useState<ModerationTab>('open')
  const [reportActionId, setReportActionId] = useState<string | null>(null)
  const [reportActionError, setReportActionError] = useState<string | null>(null)

  // 1. Dashboard metrics
  const { data: stats } = useQuery(ADMIN_QUERY_KEYS.stats, () =>
    fetchAdminDashboardStats(),
  )

  // 2. Live system health probes
  const [healthRefreshing, setHealthRefreshing] = useState(false)
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery(ADMIN_QUERY_KEYS.health, () => fetchSystemHealth())

  async function handleRefreshHealth() {
    setHealthRefreshing(true)
    try {
      await refetchHealth()
    } finally {
      setHealthRefreshing(false)
    }
  }

  // 3. Users list for suspension management
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery(ADMIN_QUERY_KEYS.users, () => fetchAdminUsers(null, 50))

  // 4. Content moderation queue
  const queueKey = ADMIN_QUERY_KEYS.queue(moderationTab)
  const {
    data: queueData,
    isLoading: queueLoading,
    refetch: refetchQueue,
  } = useQuery(queueKey, () => fetchReportQueue(moderationTab, 10))

  // 5. Audit logs stream
  const { data: auditData, isLoading: auditLoading } = useQuery(
    ADMIN_QUERY_KEYS.audit,
    () => fetchAdminAuditLogs(10),
  )

  // Handlers for suspension
  async function handleToggleSuspension(user: AdminUserRowDTO) {
    setUserActionId(user.id)
    setUserActionError(null)
    try {
      if (user.isSuspended) {
        await unsuspendUser(user.id)
      } else {
        await suspendUser(user.id)
      }
      queryClient.invalidate(ADMIN_QUERY_KEYS.users)
      queryClient.invalidate(ADMIN_QUERY_KEYS.stats)
      await refetchUsers()
    } catch (err) {
      setUserActionError(
        err instanceof Error ? err.message : 'Failed to update user suspension.',
      )
    } finally {
      setUserActionId(null)
    }
  }

  // Handlers for moderation
  async function handleReviewReport(reportId: string) {
    setReportActionId(reportId)
    setReportActionError(null)
    try {
      await reviewReport(reportId)
      queryClient.invalidate(queueKey)
      queryClient.invalidate(ADMIN_QUERY_KEYS.stats)
      await refetchQueue()
    } catch (err) {
      setReportActionError(
        err instanceof Error ? err.message : 'Failed to review report.',
      )
    } finally {
      setReportActionId(null)
    }
  }

  async function handleResolveReport(reportId: string) {
    setReportActionId(reportId)
    setReportActionError(null)
    try {
      await resolveReport(reportId)
      queryClient.invalidate(queueKey)
      queryClient.invalidate(ADMIN_QUERY_KEYS.stats)
      await refetchQueue()
    } catch (err) {
      setReportActionError(
        err instanceof Error ? err.message : 'Failed to resolve report.',
      )
    } finally {
      setReportActionId(null)
    }
  }

  async function handleSuspendReportedUser(reportedId: string) {
    setReportActionId(reportedId)
    setReportActionError(null)
    try {
      await suspendUser(reportedId)
      queryClient.invalidate(ADMIN_QUERY_KEYS.users)
      queryClient.invalidate(ADMIN_QUERY_KEYS.stats)
      await refetchUsers()
    } catch (err) {
      setReportActionError(
        err instanceof Error ? err.message : 'Failed to suspend reported user.',
      )
    } finally {
      setReportActionId(null)
    }
  }

  // Live Multi-Criteria User Filtering
  const allUsers = usersData?.items ?? []

  // Extract unique roles for dropdown selector
  const availableRoles: string[] = Array.from(
    new Set(
      allUsers
        .map((u) => u.role?.toLowerCase())
        .filter((r): r is string => Boolean(r)),
    ),
  )

  const filteredUsers = allUsers.filter((u) => {
    const role = (u.role ?? 'member').toLowerCase()

    // 1. Role Filter
    if (userRoleFilter !== 'all' && role !== userRoleFilter) {
      return false
    }

    // 2. Status Filter
    if (userStatusFilter === 'active' && u.isSuspended) return false
    if (userStatusFilter === 'suspended' && !u.isSuspended) return false

    // 3. Search Term Filter
    if (userSearch.trim()) {
      const term = userSearch.toLowerCase()
      const matchesName = u.fullName.toLowerCase().includes(term)
      const matchesId = u.id.toLowerCase().includes(term)
      const matchesRole = role.includes(term)
      if (!matchesName && !matchesId && !matchesRole) return false
    }

    return true
  })

  const userColumns: DataTableColumn<AdminUserRowDTO>[] = [
    {
      key: 'user',
      header: 'User Profile',
      cell: (user) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{user.fullName}</span>
          <span className="font-mono text-[10px] text-[var(--cx-text-4)]">
            {user.id}
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (user) => (
        <Badge variant={user.role === 'admin' ? 'brand' : 'outline'} className="capitalize">
          {user.role ?? 'member'}
        </Badge>
      ),
    },
    {
      key: 'lastActive',
      header: 'Last Active',
      cell: (user) => (
        <span className="text-xs text-[var(--cx-text-3)]">
          {user.lastActiveAt ? formatRelativeDate(user.lastActiveAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => (
        <StatusPill
          label={user.isSuspended ? 'suspended' : 'active'}
          tone={user.isSuspended ? 'danger' : 'success'}
        />
      ),
    },
    {
      key: 'action',
      header: <span className="flex justify-end">Actions</span>,
      cell: (user) => (
        <div className="flex justify-end">
          {user.isSuspended ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={userActionId === user.id}
              onClick={() => void handleToggleSuspension(user)}
            >
              Unsuspend
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={userActionId === user.id}
              onClick={() => void handleToggleSuspension(user)}
            >
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ]

  const auditColumns: DataTableColumn<AdminAuditLogDTO>[] = [
    {
      key: 'when',
      header: 'Timestamp',
      cell: (entry) => (
        <span className="whitespace-nowrap text-xs text-[var(--cx-text-3)]">
          {formatRelativeDate(entry.createdAt)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (entry) => <Badge variant="outline">{entry.action}</Badge>,
    },
    {
      key: 'actor',
      header: 'Actor ID',
      cell: (entry) => (
        <span className="font-mono text-xs">
          {entry.actorId ? entry.actorId.slice(0, 8) : 'system'}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Target Entity',
      cell: (entry) => (
        <span className="text-xs text-[var(--cx-text-2)]">
          {entry.entityType ?? '—'}
          {entry.entityId ? (
            <span className="ml-1.5 font-mono text-[10px] text-[var(--cx-text-4)]">
              {entry.entityId.slice(0, 8)}
            </span>
          ) : null}
        </span>
      ),
    },
  ]

  const reports = queueData ?? []
  const auditLogs = auditData ?? []

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs text-[var(--cx-text-3)]">Operations & Control Console</p>
        <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          Admin Console
        </h1>
      </div>

      {/* Module Navigation Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      {/* Overview Stats Tray */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <SectionHeading
          title={
            <span className="flex items-center gap-2">
              <Gauge className="size-4 text-[var(--cx-brand-strong)]" />
              Moderation & Suspensions Overview
              <StatusDot tone="brand" pulse size="sm" />
            </span>
          }
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-[var(--cx-text-3)]">
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-4 py-3">
            <span>Open reports</span>
            <StatusPill
              label={trayValue(stats?.openReports)}
              tone={stats?.openReports ? 'danger' : 'neutral'}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-4 py-3">
            <span>Reports this week</span>
            <span className="font-semibold text-[var(--cx-text-1)]">{trayValue(stats?.flaggedThisWeek)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] px-4 py-3">
            <span>Suspended accounts</span>
            <span className="font-semibold text-[var(--cx-danger)]">{trayValue(stats?.suspendedUsers)}</span>
          </div>
        </div>
      </div>

      {/* 1. Platform Performance Metric Gauges */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <Zap className="size-4 text-[var(--cx-brand-strong)]" />
                Platform Performance Metric Gauges
                <StatusDot tone="success" pulse size="sm" />
              </span>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={healthRefreshing}
            onClick={() => void handleRefreshHealth()}
            icon={<RefreshCw className={`size-3.5 ${healthRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh Telemetry
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricGauge
            label="CPU Load"
            percent={28}
            displayValue="28%"
            sublabel="0.28 / 4 Cores"
            tone="success"
            icon={<Cpu className="size-4" />}
          />
          <MetricGauge
            label="API Latency (P95)"
            percent={35}
            displayValue="42 ms"
            sublabel="Target < 120 ms"
            tone="success"
            icon={<Clock className="size-4" />}
          />
          <MetricGauge
            label="Memory Pool"
            percent={64}
            displayValue="64%"
            sublabel="3.2 GB / 5.0 GB"
            tone="warning"
            icon={<HardDrive className="size-4" />}
          />
          <MetricGauge
            label="DB Conn Pool"
            percent={36}
            displayValue="36%"
            sublabel="18 / 50 Active"
            tone="info"
            icon={<Database className="size-4" />}
          />
          <MetricGauge
            label="Cache Hit Rate"
            percent={94}
            displayValue="94.2%"
            sublabel="Redis Cluster"
            tone="success"
            icon={<Layers className="size-4" />}
          />
          <MetricGauge
            label="Queue Depth"
            percent={18}
            displayValue="18%"
            sublabel="142 Tasks Pending"
            tone="success"
            icon={<Activity className="size-4" />}
          />
        </div>
      </div>

      {/* 2. Match Velocity Chart Bars */}
      <MatchVelocityChart />

      {/* 3. Live System Health Probes */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <Activity className="size-4 text-[var(--cx-brand-strong)]" />
                Live System Health Probes
                <StatusDot
                  tone={health?.status === 'ready' ? 'success' : 'danger'}
                  pulse
                  size="sm"
                />
              </span>
            }
          />
        </div>

        {healthLoading || !health ? (
          <div className="mt-4">
            <LoadingState label="Executing system health probes…" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[var(--cx-surface-2)] p-3 text-xs">
              <span className="font-medium text-[var(--cx-text-1)]">
                Overall System Status: {health.status === 'ready' ? 'READY / OPERATIONAL' : 'DEGRADED / ACTION REQUIRED'}
              </span>
              <StatusPill
                label={health.status}
                tone={health.status === 'ready' ? 'success' : 'danger'}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {health.checks.map((check) => (
                <div
                  key={check.name}
                  className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {probeIcon(check.status)}
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--cx-text-1)]">
                        {check.name}
                      </span>
                    </div>
                    <StatusPill
                      label={check.status}
                      tone={probeStatusTone(check.status)}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--cx-text-3)]">
                    <span>Latency</span>
                    <span className="font-mono">{check.latencyMs} ms</span>
                  </div>
                  {check.detail ? (
                    <p className="mt-1 text-[11px] text-[var(--cx-danger)]">
                      {check.detail}
                    </p>
                  ) : null}
                </div>
              ))}

              <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[var(--cx-success)]" />
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--cx-text-1)]">
                      Config Status
                    </span>
                  </div>
                  <StatusPill
                    label={health.config.valid ? 'valid' : 'invalid'}
                    tone={health.config.valid ? 'success' : 'danger'}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--cx-text-3)]">
                  <span>Env Issues</span>
                  <span className="font-mono">{health.config.issueCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Live User Role Filter & Suspension Management Panel */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <UserX className="size-4 text-[var(--cx-brand-strong)]" />
                User Suspension & Role Management
                <Badge variant="outline" className="font-mono text-[10px]">
                  {filteredUsers.length} of {allUsers.length} Users
                </Badge>
              </span>
            }
          />
        </div>

        {/* Multi-Criteria Filter Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--cx-surface-2)] p-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by user name, ID, or role…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-[var(--cx-text-3)]">
              <Filter className="size-3.5 text-[var(--cx-text-4)]" />
              <span>Role:</span>
            </div>
            <Select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="w-36"
            >
              <option value="all">All Roles</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="organizer">Organizer</option>
              <option value="moderator">Moderator</option>
              {availableRoles.map(
                (role) =>
                  !['member', 'admin', 'organizer', 'moderator'].includes(role) && (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ),
              )}
            </Select>

            <div className="ml-2 flex items-center gap-1.5 text-xs text-[var(--cx-text-3)]">
              <span>Status:</span>
            </div>
            <Select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className="w-32"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
        </div>

        {userActionError ? (
          <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
            {userActionError}
          </p>
        ) : null}

        <div className="mt-4">
          {usersLoading || !usersData ? (
            <LoadingState label="Loading users…" />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={<UsersRound className="size-8" />}
              title="No users match filter criteria"
              description="Try adjusting your search query, role selector, or status filter."
            />
          ) : (
            <Card className="overflow-hidden">
              <DataTable<AdminUserRowDTO>
                rows={filteredUsers}
                columns={userColumns}
                keyField={(u) => u.id}
              />
            </Card>
          )}
        </div>
      </div>

      {/* 5. Content Moderation Flags */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <Flag className="size-4 text-[var(--cx-brand-strong)]" />
                Content Moderation Flags
              </span>
            }
          />
          <Tabs
            defaultValue="open"
            onValueChange={(val) => setModerationTab(val as ModerationTab)}
          >
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
              <TabsTrigger value="actioned">Actioned</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {reportActionError ? (
          <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
            {reportActionError}
          </p>
        ) : null}

        <div className="mt-4">
          {queueLoading || !queueData ? (
            <LoadingState label="Loading moderation queue…" />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<Flag className="size-8" />}
              title={`No ${moderationTab} reports`}
              description="Moderation flags will appear here as reported."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{report.reason}</p>
                      <p className="mt-1 text-xs text-[var(--cx-text-3)]">
                        Reporter: <span className="font-mono">{report.reporterId.slice(0, 8)}</span> → Reported: <span className="font-mono">{report.reportedId ? report.reportedId.slice(0, 8) : 'N/A'}</span> · {formatRelativeDate(report.createdAt)}
                      </p>
                    </div>
                    <Badge variant={report.status === 'open' ? 'danger' : report.status === 'reviewed' ? 'brand' : 'success'}>
                      {report.status ?? 'pending'}
                    </Badge>
                  </div>
                  {report.note ? (
                    <p className="rounded-xl bg-[var(--cx-surface-2)] px-3 py-2 text-xs leading-5 text-[var(--cx-text-2)]">
                      {report.note}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {report.status === 'open' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Eye className="size-3.5" />}
                        disabled={reportActionId === report.id}
                        onClick={() => void handleReviewReport(report.id)}
                      >
                        Mark Reviewed
                      </Button>
                    ) : null}
                    {report.status === 'reviewed' ? (
                      <Button
                        size="sm"
                        icon={<ShieldAlert className="size-3.5" />}
                        disabled={reportActionId === report.id}
                        onClick={() => void handleResolveReport(report.id)}
                      >
                        Resolve
                      </Button>
                    ) : null}
                    {report.reportedId ? (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<UserX className="size-3.5" />}
                        disabled={reportActionId === report.reportedId}
                        onClick={() => void handleSuspendReportedUser(report.reportedId)}
                      >
                        Suspend User
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Live Audit Logs Stream with CSV Export */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <ScrollText className="size-4 text-[var(--cx-brand-strong)]" />
                Live Platform Audit Logs Stream
              </span>
            }
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={auditLogs.length === 0}
              onClick={() => exportAuditLogsToCSV(auditLogs)}
              icon={<Download className="size-3.5" />}
            >
              Export CSV
            </Button>
            <Link href={ADMIN_PATHS.audit}>
              <Button variant="ghost" size="sm">
                View Full Audit Log <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {auditLoading || !auditData ? (
          <LoadingState label="Loading audit log stream…" />
        ) : auditLogs.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-8" />}
            title="No audit entries recorded yet"
            description="Audited platform actions will appear here."
          />
        ) : (
          <Card className="overflow-hidden">
            <DataTable<AdminAuditLogDTO>
              rows={auditLogs}
              columns={auditColumns}
              keyField={(entry) => entry.id}
            />
          </Card>
        )}
      </div>
    </div>
  )
}

