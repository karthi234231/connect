'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import { fetchMatches } from '@/client/api/matches'
import { MemberProfileDialog } from '@/components/people'
import {
  dismissRelationshipSuggestionAction,
  getDismissedSuggestionSourcesAction,
} from '@/app/actions/chat'
import {
  markConversationRead,
  sendChatMessage,
  watchMessages,
} from '@/client/api/chat'
import {
  MessageComposer,
  type ComposerSendDraft,
} from '@/components/chat/MessageComposer'
import { MessageList, type ChatMessage } from '@/components/chat/message-list'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { formatRelativeDate } from '@/utils/format-date'
import { cn } from '@/utils/cn'
import {
  RELATIONSHIP_SUGGESTION_SOURCES,
  type RelationshipSuggestionSource,
} from '@/lib/chat/momentum'
import { useChatConnection } from '@/hooks/use-chat-connection'
import { useLiveRegion } from '@/hooks/use-live-region'

const SUGGESTION_LABELS: Record<RelationshipSuggestionSource, string> = {
  shared_interest: 'Shared interests',
  shared_skill: 'Shared skills',
  complementary_skill: 'Complementary skills',
  shared_event: 'Shared event',
  shared_idea: 'Shared idea',
  same_city: 'Same city',
  conversation_gap: 'Conversation follow-up',
}

interface ThreadMessage {
  id: string
  content: string
  created_at: string
  sender_id: string
  attachmentUrl?: string | null
}

interface ThreadViewProps {
  matchId: string
  myId: string
  peer: { fullName: string; role: string | null; avatarUrl: string | null }
  /**
   * Render as an inline panel (two-pane chat list) without the full-page
   * main/header chrome. Defaults to the standalone full-page thread view.
   */
  embedded?: boolean
}

function newClientMessageId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `optimistic-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function attachmentCaption(draft: ComposerSendDraft): string {
  if (draft.text.trim().length > 0) return draft.text.trim()
  return draft.attachmentName ?? 'Attachment'
}

/**
 * "Getting to know each other" — relationship-suggestion surface (V10-BE-01/02).
 * Reads which canonical suggestion sources the viewer already dismissed via
 * `getDismissedSuggestionSourcesAction`, renders the remaining sources as
 * chips, and lets the viewer dismiss each one via the existing dismiss action.
 */
function RelationshipSuggestionsCard({
  matchId,
  peerName,
}: {
  matchId: string
  peerName: string
}) {
  const [open, setOpen] = useState(true)
  const [key] = useState(() => ['chat', 'suggestions', matchId].join('/'))
  const { data, isLoading, error, refetch } = useQuery(key, () =>
    getDismissedSuggestionSourcesAction(matchId),
  )
  const [dismissing, setDismissing] =
    useState<RelationshipSuggestionSource | null>(null)
  const [dismissError, setDismissError] = useState<string | null>(null)

  const dismissed = new Set(data ?? [])
  const available = RELATIONSHIP_SUGGESTION_SOURCES.filter(
    (source) => !dismissed.has(source),
  )

  async function handleDismiss(source: RelationshipSuggestionSource) {
    if (dismissing) return
    setDismissing(source)
    setDismissError(null)
    try {
      await dismissRelationshipSuggestionAction(matchId, source)
      await refetch()
    } catch {
      setDismissError(
        'That suggestion could not be dismissed. Please try again.',
      )
    } finally {
      setDismissing(null)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-[var(--cx-text-2)]">
          <Sparkles className="size-3.5 text-[var(--cx-brand-strong)]" />
          Getting to know each other
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-3.5 text-[var(--cx-text-4)] transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>

      {open ? (
        <div className="px-3 pb-3">
          {isLoading ? (
            <p className="text-xs text-[var(--cx-text-4)]">Loading…</p>
          ) : error ? (
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs text-[var(--cx-text-3)] underline-offset-2 hover:underline"
            >
              Suggestions failed to load — tap to retry.
            </button>
          ) : available.length === 0 ? (
            <p className="text-xs leading-5 text-[var(--cx-text-4)]">
              Suggested topics you haven&apos;t covered yet will appear here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[11px] text-[var(--cx-text-2)]"
                >
                  {SUGGESTION_LABELS[source]}
                  <button
                    type="button"
                    aria-label={`Dismiss ${SUGGESTION_LABELS[source]}`}
                    disabled={dismissing !== null}
                    onClick={() => void handleDismiss(source)}
                    className="rounded-full text-[var(--cx-text-4)] transition hover:text-[var(--cx-text-1)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {dismissError ? (
            <p role="alert" className="mt-2 text-xs text-[var(--cx-danger)]">
              {dismissError}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] leading-4 text-[var(--cx-text-4)]">
            Topics from your shared profile with {peerName}. Dismiss the ones
            you&apos;ve already covered.
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function ThreadView({
  matchId,
  myId,
  peer,
  embedded = false,
}: ThreadViewProps) {
  const connectionState = useChatConnection(matchId, { myId })
  const { polite: announce } = useLiveRegion()
  const [threadKey] = useState(() => keys.messages(matchId).join('/'))
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const { data, isLoading, error, refetch } = useQuery(threadKey, () =>
    watchMessages({ matchId, limit: 50 }),
  )
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pending, setPending] = useState<ThreadMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void markConversationRead(matchId).catch(() => undefined)
  }, [matchId])

  const serverMessages: ThreadMessage[] = (data ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    created_at: m.created_at,
    sender_id: m.sender_id,
    attachmentUrl: m.attachment_url ?? null,
  }))
  const confirmedIds = new Set(serverMessages.map((m) => m.id))
  const visible = [
    ...serverMessages,
    ...pending.filter((p) => !confirmedIds.has(p.id)),
  ]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [visible.length, connectionState.isPeerTyping])

  useEffect(() => {
    if (error) return
    const timer = setInterval(() => {
      void refetch().catch(() => undefined)
    }, 10000)
    return () => clearInterval(timer)
  }, [error, refetch])

  const handleDraftChange = (text: string) => {
    if (!connectionState.sendTyping) return
    if (text.length > 0) {
      connectionState.sendTyping(true)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        connectionState.sendTyping?.(false)
      }, 2500)
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      connectionState.sendTyping(false)
    }
  }

  async function handleOpenPeerProfile() {
    if (profileUserId) {
      setProfileUserId(null)
      return
    }
    if (!peer?.fullName) return
    try {
      const matches = await fetchMatches()
      const match = matches.find((m) => m.matchId === matchId)
      if (match?.otherUser?.id) {
        setProfileUserId(match.otherUser.id)
      }
    } catch {
      announce('Could not open this profile right now.')
    }
  }

  async function handleSend(draft: ComposerSendDraft) {
    if (sending) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    connectionState.sendTyping?.(false)
    const content = attachmentCaption(draft)
    setSending(true)
    setSendError(null)
    const optimistic: ThreadMessage = {
      id: newClientMessageId(),
      content,
      created_at: new Date().toISOString(),
      sender_id: myId,
    }
    setPending((prev) => [...prev, optimistic])
    try {
      await sendChatMessage({
        matchId,
        content,
        clientMessageId: optimistic.id,
        ...(draft.attachmentUrl ? { attachmentUrl: draft.attachmentUrl } : {}),
      })
      setPending((prev) => prev.filter((p) => p.id !== optimistic.id))
      await refetch()
      announce('Message sent')
    } catch {
      setPending((prev) => prev.filter((p) => p.id !== optimistic.id))
      setSendError('Message could not be sent. Please try again.')
      announce('Message could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const chatMessages: ChatMessage[] = visible.map((m) => ({
    id: m.id,
    text: m.content,
    sent: m.sender_id === myId,
    time: formatRelativeDate(m.created_at),
    status: 'sent',
    attachmentUrl: m.attachmentUrl,
    attachmentName: m.attachmentUrl
      ? m.attachmentUrl.split('/').pop() ?? 'Attachment'
      : null,
  }))

  const body = isLoading ? (
    <LoadingState label="Loading conversation…" />
  ) : error ? (
    <ErrorState onRetry={() => void refetch()} />
  ) : (
    <>
      <div aria-live="polite" className="flex flex-1 flex-col gap-2">
        {chatMessages.length === 0 && !connectionState.isPeerTyping ? (
          <p className="py-10 text-center text-sm text-[var(--cx-text-3)]">
            No messages yet. Say hello to start the conversation.
          </p>
        ) : (
          <MessageList
            messages={[chatMessages]}
            isPeerTyping={connectionState.isPeerTyping}
            peerName={peer?.fullName}
            endRef={bottomRef}
          />
        )}
      </div>

      {sendError ? (
        <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
          {sendError}
        </p>
      ) : null}

      <MessageComposer
        variant="composer"
        connectionState={connectionState.state}
        sending={sending}
        matchId={matchId}
        onSend={handleSend}
        onError={setSendError}
        onDraftChange={handleDraftChange}
      />

      <RelationshipSuggestionsCard
        matchId={matchId}
        peerName={peer?.fullName ?? ''}
      />
    </>
  )

  if (embedded) {
    return (
      <div className="flex min-h-[440px] w-full flex-col">
        {body}
        {profileUserId ? (
          <MemberProfileDialog
            open
            onOpenChange={(open) => {
              if (!open) setProfileUserId(null)
            }}
            userId={profileUserId}
            matchId={matchId}
            peerName={peer?.fullName ?? null}
          />
        ) : null}
      </div>
    )
  }

  return (
    <main className="cx-page-enter min-h-screen w-full max-w-full overflow-x-hidden bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <header className="sticky top-0 z-20 border-b border-[var(--cx-border-1)] bg-[color:var(--cx-bg)/.94] backdrop-blur-xl">
        <div className="mx-auto flex h-[50px] max-w-[1180px] items-center justify-between px-2.5 sm:h-[68px] sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cx-brand)] text-white shadow-[0_8px_24px_rgba(208,164,91,.28)]">
            <Sparkles className="size-4" />
          </div>
          <div className="flex items-center gap-3">
            {peer?.fullName && (
              <button
                type="button"
                onClick={() => void handleOpenPeerProfile()}
                title="View profile"
                className="text-sm font-medium text-[var(--cx-text-1)] underline-offset-2 hover:underline"
              >
                {peer.fullName}
              </button>
            )}
            <MessageComposer connectionState={connectionState.state} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100svh-50px)] max-w-[760px] flex-col px-4 py-6 sm:min-h-[calc(100svh-68px)] sm:px-6 lg:px-8">
        {body}
      </div>

      {profileUserId ? (
        <MemberProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setProfileUserId(null)
          }}
          userId={profileUserId}
          matchId={matchId}
          peerName={peer?.fullName ?? null}
        />
      ) : null}
    </main>
  )
}
