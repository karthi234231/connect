'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingState } from '@/components/states/LoadingState'
import {
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  NumberInput,
  Textarea,
} from '@/components/ui'
import { useQuery, queryClient } from '@/client/query/client'
import {
  getEditableEventAction,
  updateHostedEventAction,
} from '@/app/actions/hosted-events'
import { eventPath } from '@/config/routes'

/**
 * Convert a stored ISO timestamp to the `datetime-local` input value
 * (`YYYY-MM-DDTHH:mm`), tolerant of a missing/invalid value.
 */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const router = useRouter()
  const [eventKey] = useState(() => ['events', eventId, 'edit'].join('/'))
  const { data: event, isLoading } = useQuery(eventKey, () =>
    getEditableEventAction({ eventId }),
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [capacity, setCapacity] = useState(0)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Prefill from the real stored event once (no hard-coded placeholder copy).
  if (event && event.id !== loadedId) {
    setLoadedId(event.id)
    setTitle(event.title ?? '')
    setDescription(event.description ?? '')
    setDate(toLocalInputValue(event.startsAt))
    setVenue(event.locationOrLink ?? '')
    setCapacity(event.capacity ?? 0)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setSaveState('idle')
    setError(null)

    const iso = date ? new Date(date).toISOString() : undefined

    try {
      const result = await updateHostedEventAction({
        eventId,
        title,
        description: description.trim() === '' ? null : description,
        startsAt: iso,
        locationOrLink: venue.trim() === '' ? null : venue,
        capacity: capacity > 0 ? capacity : undefined,
      })

      if (!result.ok) {
        setError(result.error ?? 'That event could not be saved.')
        setSaveState('error')
        return
      }

      setSaveState('saved')
      queryClient.invalidate(eventKey)
      router.push(eventPath(eventId))
    } catch {
      setError('That event could not be saved. Please try again.')
      setSaveState('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
        {event ? (
          <Breadcrumb
            className="mb-5"
            items={[
              {
                label: 'Events',
                onClick: () => router.push('/dashboard/events'),
              },
              {
                label: event.title,
                onClick: () => router.push(eventPath(eventId)),
              },
              { label: 'Edit' },
            ]}
          />
        ) : null}
        <PageHeader
          eyebrow="Event"
          title="Edit event"
          description="Refine the details before it goes deeper into the funnel."
        />

        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            {isLoading ? (
              <LoadingState label="Loading event…" />
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Title
                  </span>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Starts at
                  </span>
                  <Input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Venue
                  </span>
                  <Input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Address or link"
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Capacity
                  </span>
                  <NumberInput
                    min={1}
                    value={capacity}
                    onValueChange={setCapacity}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                    Description
                  </span>
                  <Textarea
                    rows={4}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description"
                    disabled={saving}
                  />
                </label>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t border-[var(--cx-border-1)] p-5">
            {saveState === 'error' && error ? (
              <span className="mr-auto text-xs text-[var(--cx-danger)]">
                {error}
              </span>
            ) : null}
            <Link href={eventPath(eventId)}>
              <Button variant="ghost">Back to manage</Button>
            </Link>
            <Button
              disabled={isLoading || saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
