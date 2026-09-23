import Link from 'next/link'
import { Badge, Card, EmptyState } from '@/components/ui'
import { MessageCircle } from 'lucide-react'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchThreads } from '@/client/api/chat'
import { fetchMatches } from '@/client/api/matches'
import { formatRelativeDate } from '@/utils/format-date'

export function ThreadListPanel({
  activeMatchId,
  onSelectMatch,
}: {
  activeMatchId: string | null
  onSelectMatch?: (matchId: string) => void
}) {
  const { data: matchesData } = useQuery(keys.matches().join('/'), () =>
    fetchMatches(),
  )
  const { data, isLoading, error } = useQuery(keys.threads().join('/'), () =>
    fetchThreads(),
  )
  const threads = data ?? []
  const nameByMatch = new Map(
    (matchesData ?? []).map((m) => [m.matchId, m.otherUser.fullName] as const),
  )

  if (isLoading) {
    return (
      <Card className="self-start p-2" aria-label="Loading conversations">
        <div className="flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse px-3 py-3">
              <div className="h-3.5 w-2/3 rounded bg-[var(--cx-surface-3)]" />
              <div className="mt-1.5 h-3 w-full rounded bg-[var(--cx-surface-3)]" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (error || threads.length === 0) {
    return (
      <Card className="self-start p-4">
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No conversations yet"
          description="Matches with messages will show up here."
        />
      </Card>
    )
  }

  return (
    <Card className="self-start p-2">
      <nav aria-label="Conversations" className="flex flex-col gap-1">
        {threads.map((t) => {
          const active = t.matchId === activeMatchId
          return (
            <Link
              key={t.matchId}
              href={`/dashboard/chat/${t.matchId}`}
              onClick={(event) => {
                if (!onSelectMatch) return
                event.preventDefault()
                onSelectMatch(t.matchId)
              }}
              aria-current={active ? 'page' : undefined}
              className={`rounded-2xl px-3 py-3 transition hover:bg-[var(--cx-surface-2)] ${active ? 'bg-[var(--cx-surface-2)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">
                  {nameByMatch.get(t.matchId) ?? 'Conversation'}
                </p>
                {t.unread > 0 ? (
                  <Badge variant="brand">{t.unread}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--cx-text-3)]">
                {t.lastMessageContent ?? 'New match — say hello.'}
              </p>
              {t.lastMessageAt ? (
                <p className="mt-1 text-[10px] text-[var(--cx-text-4)]">
                  {formatRelativeDate(t.lastMessageAt)}
                </p>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </Card>
  )
}
