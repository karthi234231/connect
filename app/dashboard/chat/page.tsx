'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageSquarePlus, Users, UsersRound } from 'lucide-react'
import { cn } from '@/utils/cn'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchMatches } from '@/client/api/matches'
import { getOwnProfileAction } from '@/app/actions/profile-read'
import { useChatInbox } from '@/hooks/use-chat-inbox'
import { ThreadListPanel } from './thread-list-panel'
import { ThreadView } from './[matchId]/thread-view'

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // A-05/R-03 — the embedded selection is URL-backed via `?match=<id>`.
  // `pickedMatchId` holds the value from the most recent row tap (set in the
  // click handler so the thread swaps without waiting on navigation); the
  // `matchParam` seeds the mount case and covers refresh/share/deep-link. The
  // URL is the durable source, the local pick only accelerates immediate
  // rendering — no effect-sync (the react-hooks lint rejects setState there).
  const matchParam = searchParams.get('match')
  const [pickedMatchId, setPickedMatchId] = useState<string | null>(null)
  // The mobile "conversation visible" flag stays LOCAL state: it is
  // initialised once from the deep-link the page was opened with, and never
  // reset by URL navigation afterwards.
  const [showConversationOnMobile, setShowConversationOnMobile] = useState(
    () => matchParam != null,
  )

  const selection = pickedMatchId ?? matchParam

  const [ownProfileKey] = useState(() => ['chat', 'own-profile'].join('/'))
  const [showCreateMenu, setShowCreateMenu] = useState(false)

  const {
    threads,
    isLoading,
    error,
    refetch,
    totalUnread,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useChatInbox()
  const { data: matchesData } = useQuery(keys.matches().join('/'), () =>
    fetchMatches(),
  )
  const { data: ownProfile } = useQuery(ownProfileKey, () =>
    getOwnProfileAction(),
  )

  const selectedMatch =
    selection != null
      ? ((matchesData ?? []).find((m) => m.matchId === selection) ?? null)
      : null

  const peer = selectedMatch
    ? {
        fullName: selectedMatch.otherUser.fullName,
        role: selectedMatch.otherUser.role ?? null,
        avatarUrl: selectedMatch.otherUser.avatarUrl ?? null,
      }
    : { fullName: '', role: null, avatarUrl: null }

  function handleSelectMatch(matchId: string) {
    setPickedMatchId(matchId)
    setShowConversationOnMobile(true)
    void router.replace(
      `/dashboard/chat?match=${encodeURIComponent(matchId)}`,
      { scroll: false },
    )
  }

  return (
    <div className="cx-page-enter flex h-[calc(100svh-72px)] min-h-[min(560px,100svh)] flex-col bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <div className="mx-auto grid w-full min-w-0 max-w-[1180px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr]">
        <aside
          className={cn(
            'relative min-h-0 min-w-0 flex-col border-r border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3',
            showConversationOnMobile ? 'hidden' : 'flex',
            'lg:flex',
          )}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h1 className="text-xl font-semibold">Chats</h1>
            {totalUnread > 0 ? (
              <span
                role="status"
                aria-live="polite"
                className="rounded-full border border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--cx-brand-strong)]"
              >
                {totalUnread} unread
              </span>
            ) : null}
          </div>

          <ThreadListPanel
            activeMatchId={selection}
            onSelectMatch={handleSelectMatch}
            threads={threads}
            isLoading={isLoading}
            error={error}
            refetch={refetch}
            viewerId={ownProfile?.id ?? null}
            loadMore={loadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          />

          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
            {showCreateMenu ? (
              <div
                role="menu"
                aria-label="Start a new conversation"
                className="cx-page-enter flex w-44 flex-col overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[0_16px_40px_rgba(30,20,10,.22)]"
              >
                <Link
                  href="/dashboard/discover"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[var(--cx-text-1)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <Users className="size-4 text-[var(--cx-brand-strong)]" />
                  Browse connections
                </Link>
                <Link
                  href="/dashboard/matches"
                  role="menuitem"
                  onClick={() => setShowCreateMenu(false)}
                  className="flex items-center gap-2.5 border-t border-[var(--cx-border-1)] px-3.5 py-2.5 text-left text-sm text-[var(--cx-text-1)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <UsersRound className="size-4 text-[var(--cx-brand-strong)]" />
                  Your matches
                </Link>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCreateMenu((prev) => !prev)}
              aria-label="Create new chat"
              aria-expanded={showCreateMenu}
              className="flex size-14 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white shadow-[0_10px_28px_rgba(207,159,82,.42)] transition hover:bg-[var(--cx-brand-strong)] active:scale-95"
            >
              <MessageSquarePlus className="size-6" />
            </button>
          </div>
        </aside>

        <section
          className={cn(
            'min-h-0 min-w-0 flex-col bg-[var(--cx-bg)]',
            showConversationOnMobile ? 'flex' : 'hidden',
            'lg:flex',
          )}
        >
          {selection != null ? (
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="flex items-center gap-2.5 border-b border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-3 sm:px-4 lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowConversationOnMobile(false)}
                  aria-label="Back to conversations"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {peer.fullName}
                  </p>
                  {peer.role ? (
                    <p className="truncate text-[11px] text-[var(--cx-text-3)]">
                      {peer.role}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <ThreadView
                  embedded
                  matchId={selection}
                  myId={ownProfile?.id ?? ''}
                  peer={peer}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-[var(--cx-text-3)]">
                Select a conversation to start messaging.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function ChatPage() {
  // `useSearchParams` needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}