'use client'

import { CalendarDays, Check, MapPin, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { EventActions } from './event-actions'
import type { EventItem } from './event'

export interface EventDetailDialogProps {
  event: EventItem
  open: boolean
  onOpenChange: (open: boolean) => void
  saved?: boolean
  onSave?: () => void
  authState?: 'guest' | 'authed'
  registered?: boolean
  waitlisted?: boolean
  isRegistering?: boolean
  loginHref?: string
  onRegister?: () => void
  children?: ReactNode
}

function eventTime(event: EventItem): string {
  if (!event.startsAt) return '6:00 PM'
  return new Date(event.startsAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  saved = false,
  onSave,
  authState = 'authed',
  registered = false,
  waitlisted = false,
  isRegistering = false,
  loginHref,
  onRegister,
  children,
}: EventDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div
          className={cn(
            'relative h-36 w-full bg-gradient-to-br',
            event.tone ??
              'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)]',
          )}
        >
          <span className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full bg-white/15 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-12 right-6 size-36 rounded-full bg-black/10 blur-2xl" />
          <span className="absolute left-5 top-5 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-[#322b3a]">
            {event.month} {event.date}
          </span>
          <DialogClose className="absolute right-4 top-4 bg-white/90 text-[#322b3a] hover:bg-white" />
        </div>

        <div className="flex flex-col gap-3 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cx-brand-strong)]">
            {event.category ?? 'Community'} · {event.format}
          </p>

          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-2xl leading-tight">
              {event.title}
            </DialogTitle>
            {onSave ? (
              <button
                type="button"
                onClick={onSave}
                aria-label={saved ? 'Remove from saved events' : 'Save event'}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border transition',
                  saved
                    ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                    : 'border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:border-[var(--cx-border-2)] hover:text-[var(--cx-text-1)]',
                )}
              >
                {saved ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            ) : null}
          </div>

          {event.description ? (
            <DialogDescription>{event.description}</DialogDescription>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-start gap-2 rounded-xl bg-[var(--cx-surface-2)] p-3">
              <CalendarDays className="mt-px size-4 shrink-0 text-[var(--cx-brand)]" />
              <div>
                <p className="text-xs font-medium text-[var(--cx-text-1)]">
                  {event.month} {event.date} · {eventTime(event)}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--cx-text-3)]">
                  {event.duration}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-[var(--cx-surface-2)] p-3">
              <MapPin className="mt-px size-4 shrink-0 text-[var(--cx-brand)]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--cx-text-1)]">
                  {event.location}
                </p>
                <p className="mt-0.5 block text-[10px] text-[var(--cx-text-3)]">
                  {event.duration}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-[var(--cx-text-3)]">
            Hosted by {event.host ?? 'the Connect community'} ·{' '}
            {event.attendees} of {event.capacity} going
          </p>

          <EventActions
            authState={authState}
            registered={registered}
            waitlisted={waitlisted}
            isRegistering={isRegistering}
            loginHref={loginHref}
            onRegister={onRegister}
            size="lg"
            fullWidth
          />

          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
