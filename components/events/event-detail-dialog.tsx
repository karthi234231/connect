'use client'

import { CalendarDays, Check, Download, Globe, MapPin, Plus, Sparkles, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AvatarGroup, type AvatarGroupItem } from '@/components/ui/avatar-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { EventActions } from './event-actions'
import type { EventItem } from './event'
import { showSuccessToast } from '@/lib/toast'

export interface EventDetailDialogProps {
  event: EventItem
  open: boolean
  onOpenChange: (open: boolean) => void
  saved?: boolean
  onSave?: () => void
  onExportIcs?: () => void
  attendeeAvatars?: AvatarGroupItem[]
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
  onExportIcs,
  attendeeAvatars,
  authState = 'authed',
  registered = false,
  waitlisted = false,
  isRegistering = false,
  loginHref,
  onRegister,
  children,
}: EventDetailDialogProps) {
  const defaultAvatars: AvatarGroupItem[] = Array.from(
    { length: Math.min(event.attendees || 3, 5) },
    (_, i) => {
      const sampleNames = [
        'Alex Rivera',
        'Taylor Chen',
        'Sam Kim',
        'Jordan Smith',
        'Morgan Lee',
      ]
      const name = sampleNames[i % sampleNames.length]
      return {
        alt: name,
        initials: name
          .split(' ')
          .map((n) => n[0])
          .join(''),
      }
    },
  )

  const avatarsToRender = attendeeAvatars ?? defaultAvatars
  const isOnline = event.format === 'Online'
  const spotsLeft = event.capacity > 0 ? event.capacity - event.attendees : null

  const handleExportWithToast = () => {
    if (onExportIcs) {
      onExportIcs()
      showSuccessToast('Calendar invite (.ics) downloaded!')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0 rounded-2xl">
        <div
          className={cn(
            'relative h-36 w-full bg-gradient-to-br p-4 flex flex-col justify-between',
            event.tone ??
              'from-[var(--cx-brand-soft)] to-[var(--cx-surface-2)]',
          )}
        >
          <span className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full bg-white/15 blur-2xl" />
          <span className="pointer-events-none absolute -bottom-12 right-6 size-36 rounded-full bg-black/10 blur-2xl" />

          <div className="flex items-center justify-between z-10">
            <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-bold text-[#322b3a] shadow-sm">
              {event.month} {event.date}
            </span>
            <DialogClose className="bg-white/90 text-[#322b3a] hover:bg-white rounded-full p-1" />
          </div>

          <div className="flex items-center gap-2 z-10">
            {event.category && (
              <Badge variant="brand">{event.category.toUpperCase()}</Badge>
            )}
            {event.format && (
              <Badge variant="outline">
                {isOnline ? <Globe className="size-3" /> : <MapPin className="size-3" />}
                {event.format}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl font-semibold leading-tight text-[var(--cx-text-1)]">
                {event.title}
              </DialogTitle>
              {event.host ? (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar className="size-5 bg-[var(--cx-brand)] text-white">
                    {event.hostAvatar ? (
                      <AvatarImage src={event.hostAvatar} alt={event.host} />
                    ) : (
                      <AvatarFallback className="text-[10px] text-white">
                        {event.hostInitials ?? 'H'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-xs font-medium text-[var(--cx-text-2)]">
                    Hosted by {event.host}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onExportIcs ? (
                <button
                  type="button"
                  onClick={handleExportWithToast}
                  aria-label={`Export .ics calendar invite for ${event.title}`}
                  title="Export .ics calendar invite"
                  className="flex size-9 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-3)] transition hover:border-[var(--cx-brand)] hover:text-[var(--cx-brand-strong)] hover:bg-[var(--cx-surface-2)]"
                >
                  <Download className="size-4" />
                </button>
              ) : null}
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
          </div>

          {event.description ? (
            <DialogDescription className="text-sm text-[var(--cx-text-2)] leading-relaxed">
              {event.description}
            </DialogDescription>
          ) : null}

          {/* Time & Location Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--cx-surface-2)] p-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-[var(--cx-brand)]" />
              <div>
                <p className="text-xs font-medium text-[var(--cx-text-1)]">
                  {event.month} {event.date} · {eventTime(event)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--cx-text-3)]">
                  {event.duration}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-[var(--cx-surface-2)] p-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--cx-brand)]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[var(--cx-text-1)]">
                  {event.location}
                </p>
                <p className="mt-0.5 block text-[11px] text-[var(--cx-text-3)]">
                  {isOnline ? 'Virtual gathering' : 'In-person venue'}
                </p>
              </div>
            </div>
          </div>

          {/* Attendee Avatars Roster Preview */}
          <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarGroup items={avatarsToRender} size="md" max={4} />
                <div>
                  <p className="text-xs font-semibold text-[var(--cx-text-1)]">
                    {event.attendees} attendees registered
                  </p>
                  <p className="text-[11px] text-[var(--cx-text-3)]">
                    {event.capacity > 0
                      ? spotsLeft !== null && spotsLeft > 0
                        ? `${spotsLeft} of ${event.capacity} spots remaining`
                        : 'Waitlist active (Capacity reached)'
                      : 'Open capacity gathering'}
                  </p>
                </div>
              </div>
              {onExportIcs && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Download className="size-3.5" />}
                  onClick={handleExportWithToast}
                >
                  .ics
                </Button>
              )}
            </div>
          </div>

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
