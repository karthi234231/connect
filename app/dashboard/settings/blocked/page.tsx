'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  EmptyState,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { UsersRound } from 'lucide-react'
import { useQuery, queryClient } from '@/client/query/client'
import { getBlockedUsersAction, unblockUserAction } from '@/app/actions/safety'
import { initialsForName } from '@/types/profile'
import { showErrorToast, showSuccessToast } from '@/lib/toast'

const BLOCKED_QUERY_KEY = 'settings/blocked'

/**
 * Blocked-user management (P0-24). Lists the caller's own blocks and lets them
 * unblock. The read is RLS-scoped to the caller's blocks only.
 */
export default function BlockedUsersPage() {
  const { data, isLoading, error, refetch } = useQuery(BLOCKED_QUERY_KEY, () =>
    getBlockedUsersAction(),
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const blocked = data ?? []

  async function unblock(userId: string) {
    if (busyId) return
    setBusyId(userId)
    try {
      await unblockUserAction(userId)
      queryClient.invalidate(BLOCKED_QUERY_KEY)
      await refetch()
      showSuccessToast('Unblocked')
    } catch {
      showErrorToast('That could not be completed. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Settings"
          title="Blocked accounts"
          description="People you've blocked can't see you or contact you."
        />

        {isLoading ? (
          <LoadingState label="Loading blocked accounts…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : blocked.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-8" />}
            title="No blocked accounts"
            description="Accounts you block will show up here so you can unblock them later."
          />
        ) : (
          <div className="space-y-2">
            {blocked.map((user) => (
              <Card key={user.id} className="flex items-center gap-3 p-4">
                <Avatar className="bg-[var(--cx-surface-3)]">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                  ) : null}
                  <AvatarFallback>
                    {initialsForName(user.fullName)}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {user.fullName}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === user.id}
                  onClick={() => void unblock(user.id)}
                >
                  {busyId === user.id ? 'Unblocking…' : 'Unblock'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
