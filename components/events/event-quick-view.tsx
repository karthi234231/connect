'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { fetchGuestEvent, type GuestEventDetail } from '@/client/api/events'
import {
  getGuestRegistrationStatusAction,
  registerForEventAction,
  type GuestRegistrationStatus,
} from '@/app/actions/events'
import { AppError, ErrorCodes } from '@/lib/errors'
import { EventDetailDialog } from './event-detail-dialog'
import { guestEventToItem } from './map-to-item'

export interface EventQuickViewProps {
  eventId: string | null
  onOpenChange: (open: boolean) => void
}

type AuthState = 'guest' | 'authed'

export function EventQuickView({ eventId, onOpenChange }: EventQuickViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [event, setEvent] = useState<GuestEventDetail | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [authState, setAuthState] = useState<AuthState>('authed')
  const [registration, setRegistration] =
    useState<GuestRegistrationStatus | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loginHref = `/login?next=${encodeURIComponent(
    pathname ?? `/events/${eventId ?? ''}`,
  )}`

  const resolveRegistration = useCallback(async (id: string) => {
    try {
      return await getGuestRegistrationStatusAction({ eventId: id })
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCodes.UNAUTHENTICATED) {
        return 'guest' as const
      }
      throw err
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!eventId) return

    void (async () => {
      try {
        const [evt, status] = await Promise.all([
          fetchGuestEvent(eventId),
          resolveRegistration(eventId),
        ])
        if (cancelled) return
        setEvent(evt)
        setLoadedId(eventId)
        if (status === 'guest') {
          setAuthState('guest')
        } else {
          setAuthState('authed')
          setRegistration(status)
        }
      } catch {
        if (!cancelled) onOpenChange(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId, resolveRegistration, onOpenChange])

  const isWaitlisted = registration?.status === 'waitlisted'
  const isRegistered =
    registration?.status === 'registered' ||
    registration?.status === 'checked_in'

  const handleRegister = async () => {
    if (!event) return
    if (authState === 'guest') {
      router.push(loginHref)
      return
    }
    setIsRegistering(true)
    setActionError(null)
    try {
      const result = await registerForEventAction({ eventId: event.id })
      const waitlisted =
        result.outcome === 'waitlisted' ||
        result.outcome === 'already_waitlisted'
      setRegistration({
        status: waitlisted ? 'waitlisted' : 'registered',
        waitlistPosition: waitlisted ? result.waitlistPosition : null,
      })
      const updated = await fetchGuestEvent(event.id)
      setEvent(updated)
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCodes.UNAUTHENTICATED) {
        router.push(loginHref)
        setAuthState('guest')
      } else if (AppError.isAppError(err) && err.code === ErrorCodes.CONFLICT) {
        setActionError(
          err.userMessage ?? 'Registration for this event is closed.',
        )
      } else {
        setActionError('Something went wrong registering. Please try again.')
      }
    } finally {
      setIsRegistering(false)
    }
  }

  if (!event || loadedId !== eventId) return null

  return (
    <EventDetailDialog
      event={guestEventToItem(event)}
      open={!!eventId}
      onOpenChange={onOpenChange}
      authState={authState}
      registered={isRegistered}
      waitlisted={isWaitlisted}
      isRegistering={isRegistering}
      loginHref={loginHref}
      onRegister={isRegistered || isWaitlisted ? undefined : handleRegister}
    >
      {isWaitlisted ? (
        <div className="rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-4 py-3 text-xs text-[var(--cx-text-2)]">
          {registration?.waitlistPosition != null
            ? `You're #${registration.waitlistPosition} on the waitlist. If a spot opens you'll be moved to registered automatically.`
            : "You're on the waitlist. If a spot opens you'll be moved to registered automatically."}
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className="text-xs text-[var(--cx-danger)]">
          {actionError}
        </p>
      ) : null}
    </EventDetailDialog>
  )
}
