'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery } from '@/client/query/client'
import { fetchAdminAuditLogs } from '@/client/api/admin'
import { ADMIN_PAGE_SIZES, ADMIN_QUERY_KEYS } from '@/app/admin/consts'

import { formatRelativeDate } from '@/utils/format-date'
import { ScrollText } from 'lucide-react'
import type { AdminAuditLogDTO } from '@/lib/dto-admin'

export default function AuditPage() {
  const key = ADMIN_QUERY_KEYS.audit
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchAdminAuditLogs(ADMIN_PAGE_SIZES.audit),
  )
  const rows = data ?? []

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
    <>
      <PageHeader
        title="Audit log"
        description="The latest admin and platform actions."
      />

      {isLoading || !data ? (
        <LoadingState label="Loading audit log…" />
      ) : error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title="No audit entries yet"
          description="Audited actions will show up here."
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable<AdminAuditLogDTO>
            rows={rows}
            columns={columns}
            keyField={(entry) => entry.id}
          />
        </Card>
      )}
    </>
  )
}
