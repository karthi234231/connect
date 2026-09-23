'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/ui'
import { fetchUnreadCount } from '@/client/api/notifications'
import { cn } from '@/utils/cn'
import { NotificationsPanel } from './notifications-panel'

const POLL_INTERVAL_MS = 60_000
const BADGE_CAP = 99

export function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      setCount(await fetchUnreadCount())
    } catch {
      // Bell badge is best-effort; never break navigation over it.
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    const start = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    const onFocus = () => void refresh()
    const handleRefresh = () => void refresh()
    const handleCount = (event: Event) => {
      const customEvent = event as CustomEvent<{ count: number }>
      if (typeof customEvent.detail?.count === 'number') {
        setCount(customEvent.detail.count)
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('notifications:refresh', handleRefresh)
    window.addEventListener('notifications:count', handleCount)

    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('notifications:refresh', handleRefresh)
      window.removeEventListener('notifications:count', handleCount)
    }
  }, [refresh])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) void refresh()
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip content="Notifications" side="bottom">
        <PopoverTrigger
          aria-label="Notifications"
          className={cn(
            'relative flex size-9 items-center justify-center rounded-xl text-[var(--cx-text-2)] transition hover:bg-[var(--cx-surface-2)] hover:text-[var(--cx-text-1)]',
            open && 'bg-[var(--cx-surface-2)] text-[var(--cx-text-1)]',
          )}
        >
          <Bell className="size-4" aria-hidden="true" />
          {count > 0 ? (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--cx-brand)] px-1 text-[10px] font-bold leading-none text-white">
              {count > BADGE_CAP ? `${BADGE_CAP}+` : count}
            </span>
          ) : null}
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="p-0">
        <NotificationsPanel variant="dropdown" />
      </PopoverContent>
    </Popover>
  )
}
