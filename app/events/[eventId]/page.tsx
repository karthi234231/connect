'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Clipboard,
  Clock3,
  Download,
  MapPin,
  UsersRound,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui'
import { EventActions } from '@/components/events'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  downloadTextFile,
  fetchGuestEvent,
  type GuestEventDetail,
} from '@/client/api/events'
import {
  getGuestRegistrationStatusAction,
  registerForEventAction,
  type GuestRegistrationStatus,
} from '@/app/actions/events'
import { AppError, ErrorCodes } from '@/lib/errors'
import { formatEventDate } from '@/utils/format-date'
import { formatCount } from '@/utils/format-number'
import { generateEventIcs, getGoogleCalendarUrl } from '@/lib/calendar'

type AuthState = 'unknown' | 'guest' | 'authed'

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>()
  const eventId = typeof params?.eventId === 'string' ? params.eventId : ''

  const [event, setEvent] = useState<GuestEventDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authState, setAuthState] = useState<AuthState>('unknown')
  const [registration, setRegistration] =
    useState<GuestRegistrationStatus | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasEnded, setHasEnded] = useState(false)

  const deriveEnded = (evt: GuestEventDetail) => {
    return (
      new Date(evt.startsAt).getTime() + evt.durationMinutes * 60_000 <
      Date.now()
    )
  }

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

    async function load() {
      setIsLoading(true)
      setLoadError(false)
      try {
        const [evt, status] = await Promise.all([
          fetchGuestEvent(eventId),
          resolveRegistration(eventId),
        ])
        if (cancelled) return
        setEvent(evt)
        setHasEnded(deriveEnded(evt))
        if (status === 'guest') {
          setAuthState('guest')
        } else {
          setAuthState('authed')
          setRegistration(status)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [eventId, resolveRegistration])

  const isWaitlisted = registration?.status === 'waitlisted'
  const isRegistered =
    registration?.status === 'registered' ||
    registration?.status === 'checked_in'

  const handleRegister = async () => {
    setIsRegistering(true)
    setActionError(null)
    try {
      const result = await registerForEventAction({ eventId })
      const waitlisted =
        result.outcome === 'waitlisted' ||
        result.outcome === 'already_waitlisted'
      setRegistration({
        status: waitlisted ? 'waitlisted' : 'registered',
        waitlistPosition: waitlisted ? result.waitlistPosition : null,
      })
      const updated = await fetchGuestEvent(eventId)
      setEvent(updated)
      setHasEnded(deriveEnded(updated))
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCodes.UNAUTHENTICATED) {
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

  const downloadIcs = () => {
    if (!event) return
    const ics = generateEventIcs({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.locationOrLink,
      startsAt: event.startsAt,
      durationMinutes: event.durationMinutes,
    })
    downloadTextFile(`${event.id}.ics`, ics, 'text/calendar')
  }

  const openGoogleCalendar = () => {
    if (!event) return
    const url = getGoogleCalendarUrl({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.locationOrLink,
      startsAt: event.startsAt,
      durationMinutes: event.durationMinutes,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (non-secure context); button stays quiet.
    }
  }

  return (
    <div className="cx-page-enter">
      <Link
        href="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
      >
        <ArrowLeft className="size-4" /> Back to events
      </Link>

      {isLoading ? (
        <LoadingState label="Loading event…" />
      ) : loadError || !event ? (
        <ErrorState
          title="Couldn't load this event"
          description="We couldn't find that event. It may have been removed, or the link is incorrect."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-28 bg-[linear-gradient(120deg,var(--cx-brand-soft),var(--cx-surface-2))]">
            {event.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverImage}
                alt=""
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <CardContent className="p-5 sm:p-6">
            <CardTitle className="text-2xl">{event.title}</CardTitle>
            <CardDescription className="mt-2">
              {event.description ?? 'Details are being finalized.'}
            </CardDescription>

            <div className="mt-5 space-y-3 text-sm text-[var(--cx-text-2)]">
              <p className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                {formatEventDate(event.startsAt)}
              </p>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                {event.locationOrLink || 'Online'}
              </p>
              <p className="flex items-center gap-2.5">
                <UsersRound className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                {formatCount(event.registeredCount ?? 0)} signed up
              </p>
              <p className="flex items-center gap-2.5">
                <Clock3 className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                {event.durationMinutes} min
              </p>
              <p className="flex items-center gap-2.5">
                <Download className="size-4 shrink-0 text-[var(--cx-brand-strong)]" />
                {event.price > 0
                  ? `${event.currency ?? 'USD'} ${event.price.toFixed(2)}`
                  : 'Free'}
                {event.spotsRemaining != null
                  ? ` · ${
                      event.spotsRemaining > 0
                        ? `${event.spotsRemaining} spots left`
                        : 'full'
                    }`
                  : ''}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="brand">
                {event.type === 'irl' ? 'In person' : 'Virtual'}
              </Badge>
              <Badge variant="outline">{event.format}</Badge>
              {event.category ? (
                <Badge variant="outline">{event.category}</Badge>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <EventActions
                authState={authState === 'guest' ? 'guest' : 'authed'}
                size="lg"
                registered={isRegistered}
                waitlisted={isWaitlisted}
                hasEnded={hasEnded}
                registrationOpen={event.registrationOpen ?? true}
                isFull={event.isFull ?? false}
                isRegistering={isRegistering}
                loginHref={`/login?next=/events/${eventId}`}
                onRegister={() => void handleRegister()}
              />

              <Button
                variant="ghost"
                icon={<Download className="size-4" />}
                onClick={downloadIcs}
              >
                .ics
              </Button>
              <Button
                variant="ghost"
                icon={<CalendarPlus className="size-4" />}
                onClick={openGoogleCalendar}
              >
                Google Calendar
              </Button>
              <Button
                variant="ghost"
                icon={
                  copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Clipboard className="size-4" />
                  )
                }
                onClick={() => void copyLink()}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>

            {isWaitlisted ? (
              <div className="mt-4 rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-4 py-3 text-sm text-[var(--cx-text-2)]">
                {registration?.waitlistPosition != null
                  ? `You're #${registration.waitlistPosition} on the waitlist. If a spot opens you'll be moved to registered automatically.`
                  : "You're on the waitlist. If a spot opens you'll be moved to registered automatically."}
              </div>
            ) : null}

            {actionError ? (
              <p role="alert" className="mt-3 text-xs text-[var(--cx-danger)]">
                {actionError}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
