'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  Heart,
  MessageCircle,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Spinner } from '@/components/ui'
import { cn } from '@/utils/cn'
import { formatRelativeDate } from '@/utils/format-date'
import {
  fetchNotifications,
  markAllNotificationsRead,
  type NotificationSummary,
} from '@/client/api/notifications'
import { keys } from '@/client/query/keys'
import { useQuery } from '@/client/query/client'
import {
  NotificationItem,
  type NotificationItemData,
} from './notification-item'

export type NotificationType =
  'match' | 'message' | 'event' | 'request' | 'system'

export interface NotificationRecord {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
  href?: string
}

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  match: Heart,
  message: MessageCircle,
  event: Calendar,
  request: UserPlus,
  system: AlertTriangle,
}

const TYPE_STYLE: Record<NotificationType, string> = {
  match: 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]',
  message: 'bg-[#183a45] text-[#75d5df]',
  event: 'bg-[#4b3520] text-[#f4b56b]',
  request: 'bg-[#412d4b] text-[#e7a5e8]',
  system: 'bg-[#49302d] text-[#ffae9f]',
}

const TONE_BY_TYPE: Record<NotificationType, NotificationItemData['tone']> = {
  match: 'brand',
  message: 'info',
  event: 'success',
  request: 'brand',
  system: 'neutral',
}

/**
 * Collapse the backend notification types onto the panel's five-type icon map.
 * `email` (legacy/unused) and anything unknown degrade to `system`.
 */
function panelTypeFor(type: string | null | undefined): NotificationType {
  if (type === 'match_created') return 'match'
  if (type === 'message_received') return 'message'
  if (type === 'intro_requested') return 'request'
  if (
    type === 'event_reminder' ||
    type === 'event_group_assigned' ||
    type === 'event_waitlist_promoted'
  ) {
    return 'event'
  }
  return 'system'
}

/**
 * A notification only gets a destination when the resolver picked a real
 * surface (`open_chat` / `view_event` / `view_connections`). An `inbox`
 * fallback just points back at this page, so it is treated as no href.
 */
function hrefFor(item: NotificationSummary): string | undefined {
  const context = item.context
  if (!context || context.safeAction === 'inbox') return undefined
  return context.safeDestination
}

function toNotificationRecord(item: NotificationSummary): NotificationRecord {
  return {
    id: item.notification.id,
    type: panelTypeFor(item.notification.type),
    title: item.notification.title,
    message: item.notification.body ?? '',
    createdAt: item.notification.created_at,
    read: item.notification.read_at !== null,
    href: hrefFor(item),
  }
}

function toNotificationItemData(
  record: NotificationRecord,
): NotificationItemData {
  const Icon = TYPE_ICON[record.type]
  return {
    id: record.id,
    kind: record.type,
    title: record.title,
    detail: record.message,
    time: formatRelativeDate(record.createdAt),
    icon: <Icon className="size-4" aria-hidden="true" />,
    tone: TONE_BY_TYPE[record.type],
  }
}

export interface NotificationsPanelProps {
  variant?: 'page' | 'dropdown'
  emptyTitle?: string
  emptyDescription?: string
}

export function NotificationsPanel({
  variant = 'page',
  emptyTitle = 'No notifications yet',
  emptyDescription = 'New activity will appear here.',
}: NotificationsPanelProps) {
  const router = useRouter()
  const { data, isLoading, error, refetch } = useQuery(
    JSON.stringify(keys.notifications()),
    fetchNotifications,
  )
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const records = useMemo(() => (data ?? []).map(toNotificationRecord), [data])

  const unreadCount = useMemo(
    () => records.filter((record) => !record.read).length,
    [records],
  )

  const visibleRecords = useMemo(
    () =>
      filter === 'unread' ? records.filter((record) => !record.read) : records,
    [filter, records],
  )

  async function markAllRead() {
    await markAllNotificationsRead()
    await refetch()
  }

  function openRecord(record: NotificationRecord) {
    if (record.href) router.push(record.href)
  }

  if (variant === 'dropdown') {
    return (
      <div className="flex w-[min(92vw,360px)] flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--cx-border-1)] px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--cx-brand-strong)] transition hover:bg-[var(--cx-surface-2)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Mark all read
          </button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[var(--cx-text-3)]">
              <Spinner size="md" />
            </div>
          ) : error ? (
            <p className="px-4 py-8 text-center text-xs text-[var(--cx-danger)]">
              Couldn&apos;t load notifications.
            </p>
          ) : records.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[var(--cx-text-3)]">
              {emptyTitle}
            </p>
          ) : (
            records.map((record) => (
              <NotificationItem
                key={record.id}
                item={toNotificationItemData(record)}
                unread={!record.read}
                onClick={() => openRecord(record)}
              />
            ))
          )}
        </div>

        <Link
          href="/dashboard/notifications"
          className="block border-t border-[var(--cx-border-1)] px-3 py-2.5 text-center text-xs font-medium text-[var(--cx-brand-strong)] transition hover:bg-[var(--cx-surface-2)]"
        >
          View all
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return (
      <main
        className="flex min-h-[40svh] items-center justify-center py-16 text-[var(--cx-text-3)]"
        aria-busy="true"
      >
        <Spinner size="md" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="px-4 py-16 text-center text-[var(--cx-danger)]">
        Unable to load notifications.
      </main>
    )
  }

  return (
    <main className="mx-auto w-[min(100%-32px,820px)] min-h-[100svh] px-0 py-10 pb-16 text-[var(--cx-text-1)] md:px-0">
      <header className="flex flex-col items-start justify-between gap-6 border-b border-[var(--cx-border-1)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.12em] text-[var(--cx-brand)]">
            Stay updated
          </p>
          <h1 className="font-display text-[clamp(28px,5vw,44px)] font-semibold leading-tight tracking-[-.04em]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--cx-text-2)]">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'You are all caught up'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--cx-brand)] px-3.5 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Check className="size-4" aria-hidden="true" />
          Mark all read
        </button>
      </header>

      <div
        className="flex gap-2 py-5"
        role="tablist"
        aria-label="Notification filters"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-xl px-3.5 py-2 text-sm font-medium transition',
            filter === 'all'
              ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-text-1)]'
              : 'text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]',
          )}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'unread'}
          onClick={() => setFilter('unread')}
          className={cn(
            'rounded-xl px-3.5 py-2 text-sm font-medium transition',
            filter === 'unread'
              ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-text-1)]'
              : 'text-[var(--cx-text-2)] hover:text-[var(--cx-text-1)]',
          )}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      <section className="grid gap-3" aria-label="Notifications">
        {visibleRecords.length === 0 ? (
          <div className="rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 py-12 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--cx-surface-3)] text-[var(--cx-text-3)]">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-base font-semibold">
              {filter === 'unread' ? 'No unread notifications' : emptyTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--cx-text-2)]">
              {filter === 'unread'
                ? 'You are all caught up.'
                : emptyDescription}
            </p>
          </div>
        ) : (
          visibleRecords.map((record) => {
            const Icon = TYPE_ICON[record.type]
            const inner = (
              <>
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-[13px]',
                    TYPE_STYLE[record.type],
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold">
                      {record.title}
                    </span>
                    {!record.read && (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-[var(--cx-brand)]"
                        aria-label="Unread"
                      />
                    )}
                  </span>
                  {record.message ? (
                    <span className="mt-1.5 block text-sm leading-5 text-[var(--cx-text-2)]">
                      {record.message}
                    </span>
                  ) : null}
                  <time
                    dateTime={record.createdAt}
                    className="mt-1.5 block text-xs text-[var(--cx-text-3)]"
                  >
                    {new Date(record.createdAt).toLocaleString()}
                  </time>
                </span>
              </>
            )
            const baseClass = cn(
              'flex items-start gap-3.5 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-4',
              !record.read &&
                'border-[color:var(--cx-brand)/60] bg-[color:var(--cx-brand-soft)/35]',
            )
            return record.href ? (
              <a
                key={record.id}
                href={record.href}
                className={cn(
                  baseClass,
                  'text-[var(--cx-text-1)] no-underline transition hover:bg-[var(--cx-surface-2)]',
                )}
              >
                {inner}
              </a>
            ) : (
              <div key={record.id} className={baseClass}>
                {inner}
              </div>
            )
          })
        )}
      </section>
    </main>
  )
}
