'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  type DataTableColumn,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery } from '@/client/query/client'
import { fetchAdminEvents } from '@/client/api/admin'
import type { AdminEventRowDTO } from '@/lib/dto-admin'
import { ADMIN_PAGE_SIZES, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
import { formatEventDate } from '@/utils/format-date'
import { CalendarDays } from 'lucide-react'

function statusVariant(
  status: string,
): 'default' | 'brand' | 'success' | 'danger' {
  switch (status) {
    case 'cancelled':
      return 'danger'
    case 'published':
      return 'success'
    case 'draft':
      return 'brand'
    default:
      return 'default'
  }
}

interface LoadedPage {
  items: AdminEventRowDTO[]
  nextCursor: string | null
}

export default function AdminEventsPage() {
  const key = ADMIN_QUERY_KEYS.events
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchAdminEvents(undefined, ADMIN_PAGE_SIZES.events),
  )

  const [pages, setPages] = useState<Record<number, LoadedPage>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState<number | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const firstPage: LoadedPage | null =
    data === undefined
      ? null
      : { items: data.items, nextCursor: data.nextCursor }

  const current = currentPage === 1 ? firstPage : (pages[currentPage] ?? null)
  const events = current?.items ?? []
  const hasNext = current?.nextCursor != null
  const lastLoadedPage = Math.max(
    1,
    ...Object.keys(pages).map((p) => Number(p)),
  )
  const pageCount = hasNext ? lastLoadedPage + 1 : lastLoadedPage

  async function goToPage(page: number) {
    if (page === currentPage || loadingMore !== null) return
    if (page === 1) {
      setCurrentPage(1)
      return
    }
    if (pages[page]) {
      setCurrentPage(page)
      return
    }
    const previous = page - 1 === 1 ? firstPage : (pages[page - 1] ?? null)
    if (!previous?.nextCursor) return
    setLoadingMore(page)
    setPageError(null)
    try {
      const next = await fetchAdminEvents(
        previous.nextCursor,
        ADMIN_PAGE_SIZES.events,
      )
      setPages((prev) => ({
        ...prev,
        [page]: { items: next.items, nextCursor: next.nextCursor },
      }))
      setCurrentPage(page)
    } catch (err) {
      setPageError(
        err instanceof Error
          ? err.message
          : 'Could not load that page. Please try again.',
      )
    } finally {
      setLoadingMore(null)
    }
  }

  const columns: DataTableColumn<AdminEventRowDTO>[] = [
    {
      key: 'event',
      header: 'Event',
      cell: (event) => (
        <>
          <span className="font-medium">{event.title}</span>
          <span className="ml-2 font-mono text-[10px] text-[var(--cx-text-4)]">
            {event.id.slice(0, 8)}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (event) => (
        <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
      ),
    },
    {
      key: 'visibility',
      header: 'Visibility',
      cell: (event) => <Badge variant="outline">{event.visibility}</Badge>,
    },
    {
      key: 'organizer',
      header: 'Organizer',
      cell: (event) => (
        <span className="font-mono text-xs">
          {event.organizerId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'startsAt',
      header: 'Starts',
      cell: (event) => formatEventDate(event.startsAt),
    },
    {
      key: 'capacity',
      header: <span className="flex justify-end">Capacity</span>,
      cell: (event) => <div className="flex justify-end">{event.capacity}</div>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Event audit"
        description="Audit events and registrations."
      />

      {pageError ? (
        <p role="alert" className="mb-3 text-xs text-[var(--cx-danger)]">
          {pageError}
        </p>
      ) : null}

      {isLoading || !data ? (
        <LoadingState label="Loading events…" />
      ) : error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title="No events found"
          description="Events will show up here as they are created."
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable<AdminEventRowDTO>
            rows={events}
            columns={columns}
            keyField={(event) => event.id}
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--cx-border-1)] p-4">
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={(page) => void goToPage(page)}
            />
            {loadingMore !== null ? (
              <span className="text-xs text-[var(--cx-text-4)]">
                Loading page {loadingMore}…
              </span>
            ) : null}
          </div>
        </Card>
      )}
    </>
  )
}
