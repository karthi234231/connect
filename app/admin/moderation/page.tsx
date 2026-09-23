'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery, queryClient } from '@/client/query/client'
import {
  fetchReportQueue,
  resolveReport,
  reviewReport,
} from '@/client/api/admin'
import { ADMIN_PAGE_SIZES, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
import { formatRelativeDate } from '@/utils/format-date'
import { Eye, Flag, ShieldAlert } from 'lucide-react'

type QueueStatus = 'open' | 'reviewed' | 'actioned'

function statusBadge(status?: string | null): {
  variant: 'default' | 'brand' | 'success' | 'danger'
  label: string
} {
  switch (status) {
    case 'open':
      return { variant: 'danger', label: 'open' }
    case 'reviewed':
      return { variant: 'brand', label: 'reviewed' }
    case 'actioned':
      return { variant: 'success', label: 'actioned' }
    default:
      return { variant: 'default', label: 'pending' }
  }
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

export default function ModerationPage() {
  const [tab, setTab] = useState<QueueStatus>('open')
  const [actingId, setActingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const key = ADMIN_QUERY_KEYS.queue(tab)
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchReportQueue(tab, ADMIN_PAGE_SIZES.queue),
  )
  const reports = data ?? []

  async function runAction(id: string, action: () => Promise<void>) {
    setActingId(id)
    setActionError(null)
    try {
      await action()
      queryClient.invalidate(key)
      await refetch()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not update that report.',
      )
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Moderation queue"
        description="Triage inbound reports and appeals."
      />

      {actionError ? (
        <p role="alert" className="mb-3 text-xs text-[var(--cx-danger)]">
          {actionError}
        </p>
      ) : null}

      <Tabs
        defaultValue="open"
        onValueChange={(value) => setTab(value as QueueStatus)}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="actioned">Actioned</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <LoadingState label="Loading reports…" />
      ) : error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-8" />}
          title={`No ${tab} reports`}
          description="Reports that land here will show up in this list."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const badge = statusBadge(report.status)
            return (
              <Card key={report.id} className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{report.reason}</p>
                    <p className="mt-1 text-xs text-[var(--cx-text-3)]">
                      Reporter {shortId(report.reporterId)} → Reported{' '}
                      {shortId(report.reportedId)} ·{' '}
                      {formatRelativeDate(report.createdAt)}
                    </p>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
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
                      disabled={actingId === report.id}
                      onClick={() =>
                        void runAction(report.id, () => reviewReport(report.id))
                      }
                    >
                      Mark reviewed
                    </Button>
                  ) : null}
                  {report.status === 'reviewed' ? (
                    <Button
                      size="sm"
                      icon={<ShieldAlert className="size-3.5" />}
                      disabled={actingId === report.id}
                      onClick={() =>
                        void runAction(report.id, () =>
                          resolveReport(report.id),
                        )
                      }
                    >
                      Resolve
                    </Button>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
