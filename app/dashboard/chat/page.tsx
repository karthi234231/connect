'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, EmptyState } from '@/components/ui'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { MessageCircle } from 'lucide-react'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchThreads } from '@/client/api/chat'
import { fetchMatches } from '@/client/api/matches'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import { ThreadListPanel } from './thread-list-panel'
import { ThreadView } from './[matchId]/thread-view'

export default function ChatPage() {
  const [threadsKey] = useState(() => keys.threads().join('/'))
  const [matchesKey] = useState(() => keys.matches().join('/'))
  const [ownProfileKey] = useState(() => ['chat', 'own-profile'].join('/'))
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery(threadsKey, () =>
    fetchThreads(),
  )
  const { data: matchesData } = useQuery(matchesKey, () => fetchMatches())
  const { data: ownProfile } = useQuery(ownProfileKey, () =>
    getOwnProfileAction(),
  )
  const threads = data ?? []

  const selectedMatch =
    selectedMatchId != null
      ? ((matchesData ?? []).find((m) => m.matchId === selectedMatchId) ?? null)
      : null

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Chat"
          description="Conversations worth making space for."
        />

        {isLoading ? (
          <LoadingState label="Loading conversations…" />
        ) : error ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : threads.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="size-8" />}
            title="No conversations yet"
            description="Matches with messages will show up here."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
            <ThreadListPanel
              activeMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
            />

            {selectedMatchId != null ? (
              <Card className="min-h-[440px]">
                <ThreadView
                  embedded
                  matchId={selectedMatchId}
                  myId={ownProfile?.id ?? ''}
                  peer={
                    selectedMatch
                      ? {
                          fullName: selectedMatch.otherUser.fullName,
                          role: selectedMatch.otherUser.role ?? null,
                          avatarUrl: selectedMatch.otherUser.avatarUrl ?? null,
                        }
                      : { fullName: '', role: null, avatarUrl: null }
                  }
                />
              </Card>
            ) : (
              <Card className="flex min-h-[440px] flex-col items-center justify-center p-5 sm:p-6">
                <p className="text-sm text-[var(--cx-text-3)]">
                  Select a conversation to start messaging.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
