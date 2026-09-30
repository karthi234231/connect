'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  MessageSquarePlus,
  Moon,
  Plus,
  Sun,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { MessageReaction, ReactionSummary } from '@/lib/chat/reactions'
import { ThreadList, type ChatThread } from './thread-list'
import { MessageList, type ChatMessage } from './message-list'
import { MessageComposer, type ComposerSendDraft } from './message-composer'

interface RawReaction {
  emoji: string
  count: number
  reactedByViewer: boolean
}

interface RawMessage {
  id: string
  senderId: string
  content: string
  time: string
  status?: 'sent' | 'read' | 'pending'
  attachmentUrl?: string
  attachmentName?: string
  senderName?: string
  senderInitials?: string
  senderTone?: string
  reactions?: RawReaction[]
}

interface RawThread {
  id: string
  peer: { id: string; name: string; role: string | null; avatarUrl: string | null }
  initials: string
  tone: string
  kind: 'Direct' | 'Group'
  memberCount?: number
  unread: number
  messages: RawMessage[]
}

export interface ShowcaseData {
  me: { id: string; name: string; initials: string }
  threads: RawThread[]
}

const CANNED_REPLIES = [
  'Love it \u2014 sounds like a plan!',
  'Haha totally. Let me get back to you in a bit \uD83D\uDE04',
  'Ooh nice, I hadn\u2019t thought of that.',
  'For sure. Sending you the details now.',
]

function nowLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toReactionSummaries(
  reactions: RawReaction[] | undefined,
): ReactionSummary[] {
  if (!reactions) return []
  return reactions.map((reaction) => ({
    emoji: reaction.emoji as MessageReaction,
    count: reaction.count,
    reactedByViewer: reaction.reactedByViewer,
    label: `${reaction.count} ${reaction.count === 1 ? 'person' : 'people'} reacted with ${reaction.emoji}`,
  }))
}

function toggleRawReaction(
  reactions: RawReaction[] | undefined,
  emoji: string,
): RawReaction[] {
  const list = reactions ? [...reactions] : []
  const index = list.findIndex((reaction) => reaction.emoji === emoji)
  if (index === -1) {
    return [...list, { emoji, count: 1, reactedByViewer: true }]
  }
  const current = list[index]
  if (current.reactedByViewer) {
    const nextCount = current.count - 1
    if (nextCount <= 0) {
      list.splice(index, 1)
      return list
    }
    list[index] = { ...current, count: nextCount, reactedByViewer: false }
    return list
  }
  list[index] = {
    ...current,
    count: current.count + 1,
    reactedByViewer: true,
  }
  return list
}

type ThreadFilter = 'All' | 'Direct' | 'Group'

export function ChatShowcase({ data }: { data: ShowcaseData }) {
  const meId = data.me.id
  const [threads, setThreads] = useState<RawThread[]>(data.threads)
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, RawMessage[]>
  >(() =>
    Object.fromEntries(data.threads.map((thread) => [thread.id, thread.messages])),
  )
  const [selectedId, setSelectedId] = useState<string>(data.threads[0]?.id ?? '')
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false)
  const [sending, setSending] = useState(false)
  const [typingThreadId, setTypingThreadId] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [filter, setFilter] = useState<ThreadFilter>('All')
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedThread = threads.find((thread) => thread.id === selectedId)
  const threadMessages = messagesByThread[selectedId] ?? []

  const threadListItems: ChatThread[] = useMemo(
    () =>
      threads.map((thread) => {
        const msgs = messagesByThread[thread.id] ?? []
        const last = msgs[msgs.length - 1]
        const lastMessage = last
          ? last.content.trim().length > 0
            ? last.content
            : last.attachmentName
              ? '\uD83D\uDCCE Attachment'
              : 'New message'
          : 'Say hello \uD83D\uDC4B'
        return {
          id: thread.id,
          name: thread.peer.name,
          initials: thread.initials,
          tone: thread.tone,
          lastMessage,
          time: last?.time ?? '',
          kind: thread.kind,
          unread: thread.unread > 0,
          memberCount: thread.memberCount,
        }
      }),
    [threads, messagesByThread],
  )

  const visibleThreads = useMemo(() => {
    if (filter === 'All') return threadListItems
    return threadListItems.filter((thread) =>
      filter === 'Group'
        ? thread.kind === 'Group'
        : thread.kind !== 'Group',
    )
  }, [threadListItems, filter])

  const chatMessages: ChatMessage[] = threadMessages.map((message) => {
    const sent = message.senderId === meId
    return {
      id: message.id,
      text: message.content,
      sent,
      time: message.time,
      status: sent ? (message.status ?? 'sent') : undefined,
      senderName: message.senderName,
      senderInitials: message.senderInitials,
      senderTone: message.senderTone,
      attachmentUrl: message.attachmentUrl ?? null,
      attachmentName: message.attachmentName ?? null,
      reactions: toReactionSummaries(message.reactions),
    }
  })

  function handleToggleReaction(messageId: string, emoji: MessageReaction) {
    setMessagesByThread((prev) => ({
      ...prev,
      [selectedId]: (prev[selectedId] ?? []).map((message) =>
        message.id === messageId
          ? { ...message, reactions: toggleRawReaction(message.reactions, emoji) }
          : message,
      ),
    }))
  }

  async function handleSend(draft: ComposerSendDraft) {
    if (!selectedThread || sending) return
    setSending(true)
    const outgoing: RawMessage = {
      id: `${selectedId}-me-${Date.now()}`,
      senderId: meId,
      content: draft.text,
      time: nowLabel(),
      status: 'sent',
      ...(draft.attachmentUrl
        ? { attachmentUrl: draft.attachmentUrl, attachmentName: draft.attachmentName }
        : {}),
    }
    setMessagesByThread((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), outgoing],
    }))
    setSending(false)

    // Simulate the peer reading, typing, then replying (showcase only).
    const replyThreadId = selectedId
    window.setTimeout(() => {
      setMessagesByThread((prev) => ({
        ...prev,
        [replyThreadId]: (prev[replyThreadId] ?? []).map((message) =>
          message.id === outgoing.id ? { ...message, status: 'read' } : message,
        ),
      }))
      setTypingThreadId(replyThreadId)
    }, 700)

    window.setTimeout(() => {
      setTypingThreadId((current) =>
        current === replyThreadId ? null : current,
      )
      const thread = threads.find((t) => t.id === replyThreadId)
      if (!thread) return
      const replier =
        thread.kind === 'Group'
          ? { id: 'u_sana', name: 'Sana', initials: 'SA', tone: 'bg-emerald-200' }
          : {
              id: thread.peer.id,
              name: thread.peer.name,
              initials: thread.initials,
              tone: thread.tone,
            }
      const reply: RawMessage = {
        id: `${replyThreadId}-peer-${Date.now()}`,
        senderId: replier.id,
        content: CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)],
        time: nowLabel(),
        ...(thread.kind === 'Group'
          ? {
              senderName: replier.name,
              senderInitials: replier.initials,
              senderTone: replier.tone,
            }
          : {}),
      }
      setMessagesByThread((prev) => ({
        ...prev,
        [replyThreadId]: [...(prev[replyThreadId] ?? []), reply],
      }))
    }, 2400)
  }

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }

  const TONES = [
    'bg-amber-200',
    'bg-rose-200',
    'bg-sky-200',
    'bg-violet-200',
    'bg-emerald-200',
  ]

  function createThread(variant: 'community' | 'group' | 'chat') {
    const id = `new-${Date.now()}`
    const isGroup = variant !== 'chat'
    const name =
      variant === 'community'
        ? 'New Community'
        : variant === 'group'
          ? 'New Group'
          : 'New Chat'
    const newThread: RawThread = {
      id,
      peer: {
        id,
        name,
        role: isGroup ? null : 'Draft conversation',
        avatarUrl: null,
      },
      initials: isGroup ? 'NG' : 'NC',
      tone: TONES[Math.floor(Math.random() * TONES.length)],
      kind: isGroup ? 'Group' : 'Direct',
      memberCount: variant === 'community' ? 24 : variant === 'group' ? 1 : undefined,
      unread: 0,
      messages: [],
    }
    setThreads((prev) => [newThread, ...prev])
    setMessagesByThread((prev) => ({ ...prev, [id]: [] }))
    setSelectedId(id)
    setShowThreadOnMobile(true)
    setShowCreateMenu(false)
    if (isGroup) setFilter((f) => (f === 'Direct' ? 'All' : f))
    else setFilter((f) => (f === 'Group' ? 'All' : f))
  }

  const isGroupThread = selectedThread?.kind === 'Group'
  const peerSubtitle = isGroupThread
    ? `${selectedThread?.memberCount ?? 0} members`
    : (selectedThread?.peer.role ?? '')

  return (
    <div className="cx-page-enter flex h-svh flex-col bg-[var(--cx-bg)] text-[var(--cx-text-1)]">
      <div className="mx-auto grid w-full min-w-0 max-w-[1180px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr]">
        {/* Thread list */}
        <aside
          className={cn(
            'relative min-h-0 min-w-0 flex-col border-r border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-3',
            showThreadOnMobile ? 'hidden' : 'flex',
            'lg:flex',
          )}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h1 className="text-xl font-semibold">Chats</h1>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)]"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>

          {/* WhatsApp-style filter chips */}
          <div className="mb-2 flex items-center gap-2 px-1">
            {(['All', 'Direct', 'Group'] as ThreadFilter[]).map((option) => {
              const active = filter === option
              const label = option === 'Group' ? 'Groups' : option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    active
                      ? 'bg-[var(--cx-brand)] text-white shadow-[0_4px_12px_rgba(207,159,82,.28)]'
                      : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-3)]',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleThreads.length > 0 ? (
              <ThreadList
                threads={visibleThreads}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  setShowThreadOnMobile(true)
                }}
              />
            ) : (
              <p className="px-3 py-8 text-center text-xs text-[var(--cx-text-3)]">
                No {filter === 'Group' ? 'groups' : 'direct chats'} yet.
              </p>
            )}
          </div>

          {/* Create FAB (new chat / group / community) */}
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
            {showCreateMenu ? (
              <div
                role="menu"
                className="cx-page-enter flex w-44 flex-col overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[0_16px_40px_rgba(30,20,10,.22)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createThread('community')}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[var(--cx-text-1)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <UsersRound className="size-4 text-[var(--cx-brand-strong)]" />
                  New community
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createThread('group')}
                  className="flex items-center gap-2.5 border-t border-[var(--cx-border-1)] px-3.5 py-2.5 text-left text-sm text-[var(--cx-text-1)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <Users className="size-4 text-[var(--cx-brand-strong)]" />
                  New group
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createThread('chat')}
                  className="flex items-center gap-2.5 border-t border-[var(--cx-border-1)] px-3.5 py-2.5 text-left text-sm text-[var(--cx-text-1)] transition hover:bg-[var(--cx-surface-2)]"
                >
                  <UserPlus className="size-4 text-[var(--cx-brand-strong)]" />
                  New chat
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCreateMenu((prev) => !prev)}
              aria-label="Create new chat, group, or community"
              aria-expanded={showCreateMenu}
              className="flex size-14 items-center justify-center rounded-full bg-[var(--cx-brand)] text-white shadow-[0_10px_28px_rgba(207,159,82,.42)] transition hover:bg-[var(--cx-brand-strong)] active:scale-95"
            >
              {showCreateMenu ? (
                <Plus className="size-6 rotate-45 transition-transform" />
              ) : (
                <MessageSquarePlus className="size-6" />
              )}
            </button>
          </div>
        </aside>

        {/* Thread view */}
        <section
          className={cn(
            'min-h-0 min-w-0 flex-col bg-[var(--cx-bg)]',
            showThreadOnMobile ? 'flex' : 'hidden',
            'lg:flex',
          )}
        >
          {selectedThread ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setShowThreadOnMobile(false)}
                  aria-label="Back to conversations"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)] lg:hidden"
                >
                  <ArrowLeft className="size-4" />
                </button>
                {isGroupThread ? (
                  <div
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cx-surface-3)] text-[var(--cx-brand-strong)] ring-1 ring-[var(--cx-border-2)]"
                  >
                    <Users className="size-4" />
                  </div>
                ) : selectedThread.peer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedThread.peer.avatarUrl || '/placeholder.svg'}
                    alt={selectedThread.peer.name}
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#332d3d]',
                      selectedThread.tone,
                    )}
                  >
                    {selectedThread.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {selectedThread.peer.name}
                  </p>
                  {peerSubtitle ? (
                    <p className="flex items-center gap-1 truncate text-[11px] text-[var(--cx-text-3)]">
                      {isGroupThread ? null : (
                        <span
                          aria-hidden="true"
                          className="size-1.5 shrink-0 rounded-full bg-[var(--cx-success)]"
                        />
                      )}
                      <span className="truncate">{peerSubtitle}</span>
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-block',
                    isGroupThread
                      ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                      : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-3)]',
                  )}
                >
                  {isGroupThread ? 'Group' : 'Direct'}
                </span>
              </div>

              <MessageList
                className="min-h-0 flex-1"
                messages={[chatMessages]}
                endRef={bottomRef}
                onToggleReaction={handleToggleReaction}
                isPeerTyping={typingThreadId === selectedId}
                peerName={selectedThread.peer.name}
                peerTone={selectedThread.tone}
              />

              <div className="border-t border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-3 py-3 sm:px-4">
                <MessageComposer
                  autoFocus
                  allowAttachments
                  sending={sending}
                  onSend={handleSend}
                  placeholder={
                    isGroupThread
                      ? `Message ${selectedThread.peer.name}\u2026`
                      : `Message ${selectedThread.peer.name.split(' ')[0]}\u2026`
                  }
                />
              </div>
            </>
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

export default ChatShowcase
