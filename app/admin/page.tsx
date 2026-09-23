'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Eye,
  Flag,
  Gauge,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UsersRound,
  XCircle,
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

type ModerationTab = 'open' | 'reviewed' | 'actioned'

export default function AdminPage() {
  const [userSearch, setUserSearch] = useState('')
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
  const {
    data: health,
    isLoading: healthLoading,
    isFetching: healthRefreshing,
    refetch: refetchHealth,
  } = useQuery(ADMIN_QUERY_KEYS.health, () => fetchSystemHealth())

  // 3. Users list for suspension management
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery(ADMIN_QUERY_KEYS.users, () => fetchAdminUsers(null, 20))

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
    () => fetchAdminAuditLogs(8),
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

  // User table filtering
  const allUsers = usersData?.items ?? []
  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return true
    const term = userSearch.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term) ||
      (u.role && u.role.toLowerCase().includes(term))
    )
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
      cell: (user) => <span className="capitalize text-xs">{user.role ?? 'member'}</span>,
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

      {/* 1. Live System Health Probes */}
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
          <Button
            variant="ghost"
            size="sm"
            disabled={healthRefreshing}
            onClick={() => void refetchHealth()}
            icon={<RefreshCw className={`size-3.5 ${healthRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh Probes
          </Button>
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

      {/* 2. User Suspension Management Panel */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <UserX className="size-4 text-[var(--cx-brand-strong)]" />
                User Suspension Management
              </span>
            }
          />
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search user name or ID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
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
              title="No users match search criteria"
              description="Try adjusting your search or filter."
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

      {/* 3. Content Moderation Flags */}
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

      {/* 4. Live Audit Logs Stream */}
      <div className="rounded-[20px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading
            title={
              <span className="flex items-center gap-2">
                <ScrollText className="size-4 text-[var(--cx-brand-strong)]" />
                Live Platform Audit Logs
              </span>
            }
          />
          <Link href={ADMIN_PATHS.audit}>
            <Button variant="ghost" size="sm">
              View Full Audit Log <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </Link>
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
