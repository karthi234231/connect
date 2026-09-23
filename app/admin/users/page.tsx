'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Pagination,
  StatusPill,
  type DataTableColumn,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { useQuery, queryClient } from '@/client/query/client'
import { fetchAdminUsers, suspendUser, unsuspendUser } from '@/client/api/admin'
import type { AdminUserRowDTO } from '@/lib/dto-admin'
import { ADMIN_PAGE_SIZES, ADMIN_QUERY_KEYS } from '@/app/admin/consts'
import { formatRelativeDate } from '@/utils/format-date'
import { UsersRound } from 'lucide-react'

interface LoadedPage {
  items: AdminUserRowDTO[]
  nextCursor: string | null
}

/**
 * Keyset-paginated admin users list. getAdminUsers is cursor-based (no total
 * page count), so pagination renders only the pages reachable from the current
 * cursor chain — page 1 plus one "next" page. Earlier pages stay loaded so you
 * can step back.
 */
export default function UsersPage() {
  const key = ADMIN_QUERY_KEYS.users
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    fetchAdminUsers(undefined, ADMIN_PAGE_SIZES.users),
  )

  const [pages, setPages] = useState<Record<number, LoadedPage>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState<number | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const firstPage: LoadedPage | null =
    data === undefined
      ? null
      : { items: data.items, nextCursor: data.nextCursor }

  const current = currentPage === 1 ? firstPage : (pages[currentPage] ?? null)
  const users = current?.items ?? []
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
      const next = await fetchAdminUsers(
        previous.nextCursor,
        ADMIN_PAGE_SIZES.users,
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

  async function toggleSuspension(user: AdminUserRowDTO) {
    setActingId(user.id)
    setPageError(null)
    try {
      if (user.isSuspended) {
        await unsuspendUser(user.id)
      } else {
        await suspendUser(user.id)
      }
      // The list changed server-side; drop the cached pages and return to page 1.
      queryClient.invalidate(key)
      setPages({})
      setCurrentPage(1)
      await refetch()
    } catch (err) {
      setPageError(
        err instanceof Error
          ? err.message
          : 'Could not update that account. Please try again.',
      )
    } finally {
      setActingId(null)
    }
  }

  const columns: DataTableColumn<AdminUserRowDTO>[] = [
    {
      key: 'user',
      header: 'User',
      cell: (user) => (
        <>
          <span className="font-medium">{user.fullName}</span>
          <span className="ml-2 font-mono text-[10px] text-[var(--cx-text-4)]">
            {user.id.slice(0, 8)}
          </span>
        </>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (user) => <span className="capitalize">{user.role ?? '—'}</span>,
    },
    {
      key: 'lastActive',
      header: 'Last active',
      cell: (user) =>
        user.lastActiveAt ? formatRelativeDate(user.lastActiveAt) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) =>
        user.isSuspended ? (
          <StatusPill label="suspended" tone="danger" />
        ) : (
          <StatusPill label="active" tone="success" />
        ),
    },
    {
      key: 'action',
      header: <span className="flex justify-end">Action</span>,
      cell: (user) => (
        <div className="flex justify-end">
          {user.isSuspended ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={actingId === user.id}
              onClick={() => void toggleSuspension(user)}
            >
              Unsuspend
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={actingId === user.id}
              onClick={() => void toggleSuspension(user)}
            >
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Manage users"
        description="Search profiles, manage suspension."
      />

      {pageError ? (
        <p role="alert" className="mb-3 text-xs text-[var(--cx-danger)]">
          {pageError}
        </p>
      ) : null}

      {isLoading || !data ? (
        <LoadingState label="Loading users…" />
      ) : error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-8" />}
          title="No users found"
          description="Accounts will show up here as they join."
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable<AdminUserRowDTO>
            rows={users}
            columns={columns}
            keyField={(user) => user.id}
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
