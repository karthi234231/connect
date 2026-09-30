'use client'

// Connect · Requests / Sent tab — the people connection-request loop.
//
// Incoming requests can be accepted or declined (respondToConnectionRequest →
// respond_connection_request RPC). Outgoing ("sent") requests are read-only
// status rows. Both read the SAME connection feed the /dashboard/connections
// page uses, so the two surfaces can never disagree.
import { useState } from 'react'
import { Check, Clock3, MailOpen, Send, UsersRound, X } from 'lucide-react'

import { keys } from '@/client/query/keys'
import { queryClient, useQuery } from '@/client/query/client'
import { fetchConnections, respondToConnectionRequest } from '@/client/api/connections'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  Chip,
  EmptyState,
} from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { MemberProfileDialog } from '@/components/people'
import { useLiveRegion } from '@/hooks/use-live-region'
import { showErrorToast, showSuccessToast } from '@/lib/toast'
import { initialsForName } from '@/types/profile'

export type ConnectionMode = 'requests' | 'sent'

export function ConnectConnectionsTab({ mode }: { mode: ConnectionMode }) {
  const { polite: announce } = useLiveRegion()
  const [feedKey] = useState(() => keys.connections().join('/'))
  const { data, isLoading, error, refetch } = useQuery(feedKey, () =>
    fetchConnections(),
  )

  const [actingId, setActingId] = useState<string | null>(null)
  const [profileTarget, setProfileTarget] = useState<{
    userId: string
    name: string
  } | null>(null)

  const rows = (mode === 'requests' ? data?.incoming : data?.outgoing) ?? []

  async function respond(requestId: string, decision: 'accept' | 'decline') {
    if (actingId != null) return
    setActingId(requestId)
    try {
      await respondToConnectionRequest({ requestId, decision })
      queryClient.invalidate(feedKey)
      await refetch().catch(() => undefined)
      const message =
        decision === 'accept' ? 'Connection accepted' : 'Request declined'
      showSuccessToast(message)
      announce(message)
    } catch {
      showErrorToast('Could not update that request. Please try again.')
      announce('Could not update that request.')
    } finally {
      setActingId(null)
    }
  }

  if (isLoading) return <LoadingState label="Loading requests…" />
  if (error) return <ErrorState onRetry={() => void refetch()} />

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
        <EmptyState
          icon={
            mode === 'requests' ? (
              <MailOpen className="size-7" />
            ) : (
              <Send className="size-7" />
            )
          }
          title={
            mode === 'requests'
              ? 'No pending requests'
              : 'No sent requests'
          }
          description={
            mode === 'requests'
              ? 'When someone asks to connect with you, it lands here.'
              : 'Requests you send from Discover will show up here.'
          }
        />
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((request) => {
        const peer = request.counterpart
        const name = peer?.fullName ?? 'Member'
        const busy = actingId === request.id

        return (
          <Card key={request.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={!peer}
                onClick={() => {
                  if (peer) setProfileTarget({ userId: peer.id, name })
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Avatar className="bg-[var(--cx-surface-3)]">
                  {peer?.avatarUrl ? (
                    <AvatarImage src={peer.avatarUrl} alt={name} />
                  ) : null}
                  <AvatarFallback>{initialsForName(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium hover:underline">
                    {name}
                  </p>
                  {peer?.role ? (
                    <p className="truncate text-xs text-[var(--cx-text-3)]">
                      {peer.role}
                    </p>
                  ) : null}
                </div>
              </button>
              <Chip
                className="pointer-events-none shrink-0"
                active={mode === 'requests'}
              >
                {mode === 'requests' ? (
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="size-3" />
                    Incoming
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="size-3" />
                    Sent
                  </span>
                )}
              </Chip>
            </div>

            {request.message ? (
              <p className="line-clamp-3 text-xs leading-5 text-[var(--cx-text-3)]">
                {request.message}
              </p>
            ) : null}

            {mode === 'requests' ? (
              <div className="mt-auto flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  icon={<Check className="size-3.5" />}
                  disabled={busy}
                  onClick={() => void respond(request.id, 'accept')}
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  icon={<X className="size-3.5" />}
                  disabled={busy}
                  onClick={() => void respond(request.id, 'decline')}
                >
                  Decline
                </Button>
              </div>
            ) : (
              <p className="mt-auto text-[11px] text-[var(--cx-text-4)]">
                Awaiting their response.
              </p>
            )}
          </Card>
        )
      })}

      {profileTarget ? (
        <MemberProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setProfileTarget(null)
          }}
          userId={profileTarget.userId}
          peerName={profileTarget.name}
        />
      ) : null}
    </div>
  )
}
