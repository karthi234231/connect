import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface NotificationItemData {
  id: string
  kind: string
  title: string
  detail: string
  time: string
  icon?: ReactNode
  tone?: 'brand' | 'info' | 'success' | 'neutral'
}

export interface NotificationItemProps {
  item: NotificationItemData
  unread?: boolean
  onClick?: () => void
  showUnreadLabel?: boolean
}

const toneClasses: Record<NonNullable<NotificationItemData['tone']>, string> = {
  brand: 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]',
  info: 'bg-[var(--cx-info-soft)] text-[var(--cx-info)]',
  success: 'bg-[var(--cx-success-soft)] text-[var(--cx-success)]',
  neutral: 'bg-[var(--cx-surface-3)] text-[var(--cx-text-2)]',
}

export function NotificationItem({
  item,
  unread = false,
  onClick,
  showUnreadLabel = false,
}: NotificationItemProps) {
  const { title, detail, time, icon, tone = 'neutral' } = item

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3.5 text-left transition',
        'hover:bg-[var(--cx-surface-2)]',
        unread && 'bg-[color:var(--cx-brand-soft)/.22]',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          toneClasses[tone],
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              unread ? 'text-[var(--cx-text-1)]' : 'text-[var(--cx-text-2)]',
            )}
          >
            {title}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--cx-text-4)]">
            {time}
          </span>
        </span>
        <span className="mt-0.5 block text-xs leading-4 text-[var(--cx-text-3)]">
          {detail}
        </span>
        {unread && showUnreadLabel ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--cx-brand-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--cx-brand-strong)]">
            <span
              className="size-1.5 rounded-full bg-[var(--cx-brand)]"
              aria-hidden="true"
            />
            Unread
          </span>
        ) : null}
      </span>
    </button>
  )
}
