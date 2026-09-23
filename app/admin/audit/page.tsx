'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Select,
  type DataTableColumn,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery } from '@/client/query/client'
import { fetchAdminAuditLogs } from '@/client/api/admin'
import { ADMIN_PAGE_SIZES, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
import { formatRelativeDate } from '@/utils/format-date'
import { Download, Filter, RefreshCw, ScrollText, Search } from 'lucide-react'
import type { AdminAuditLogDTO } from '@/lib/dto-admin'

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
    `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function AuditPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const key = ADMIN_QUERY_KEYS.audit
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchAdminAuditLogs(ADMIN_PAGE_SIZES.audit),
  )
  const rows = data ?? []

  // Extract unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(rows.map((r) => r.action))).sort()

  const filteredRows = rows.filter((entry) => {
    if (actionFilter !== 'all' && entry.action !== actionFilter) {
      return false
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const matchesAction = entry.action.toLowerCase().includes(term)
      const matchesActor = (entry.actorId ?? '').toLowerCase().includes(term)
      const matchesEntityType = (entry.entityType ?? '').toLowerCase().includes(term)
      const matchesEntityId = (entry.entityId ?? '').toLowerCase().includes(term)
      if (!matchesAction && !matchesActor && !matchesEntityType && !matchesEntityId) {
        return false
      }
    }
    return true
  })

  const columns: DataTableColumn<AdminAuditLogDTO>[] = [
    {
      key: 'when',
      header: 'When',
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
      header: 'Actor',
      cell: (entry) => (
        <span className="font-mono text-xs">
          {entry.actorId ? entry.actorId.slice(0, 12) : 'system'}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      cell: (entry) => (
        <span className="text-xs text-[var(--cx-text-2)]">
          {entry.entityType ?? '—'}
          {entry.entityId ? (
            <span className="ml-2 font-mono text-[10px] text-[var(--cx-text-4)]">
              {entry.entityId.slice(0, 8)}
            </span>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Audit log"
          description="The latest admin and platform actions."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
            icon={<RefreshCw className="size-3.5" />}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={filteredRows.length === 0}
            onClick={() => exportAuditLogsToCSV(filteredRows)}
            icon={<Download className="size-3.5" />}
          >
            Export CSV ({filteredRows.length})
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search by action, actor, or entity ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="size-4 text-[var(--cx-text-3)]" />
          <Select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading || !data ? (
        <LoadingState label="Loading audit log…" />
      ) : error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title="No audit entries matched"
          description="Try clearing your search or filter parameters."
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable<AdminAuditLogDTO>
            rows={filteredRows}
            columns={columns}
            keyField={(entry) => entry.id}
          />
        </Card>
      )}
    </div>
  )
}

