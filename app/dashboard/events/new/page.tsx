'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, CalendarDays, MapPin, Plus, Ticket } from 'lucide-react'
import { Button, Input, NumberInput, Textarea } from '@/components/ui'
import { createHostedEventAction } from '@/app/actions/hosted-events'
import { ROUTES, eventPath } from '@/config/routes'

const FORMATS = [
  { value: 'social', label: 'Social' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'office_hours', label: 'Office hours' },
  { value: 'build_night', label: 'Build night' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'coffee', label: 'Coffee' },
] as const

export default function NewEventPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [locationOrLink, setLocationOrLink] = useState('')
  const [capacity, setCapacity] = useState(50)
  const [format, setFormat] = useState<string>('social')
  const [type, setType] = useState<'virtual' | 'irl'>('virtual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    setError(null)

    const iso = startsAt ? new Date(startsAt).toISOString() : ''

    setSaving(true)
    try {
      const result = await createHostedEventAction({
        title,
        description: description.trim() === '' ? null : description,
        startsAt: iso,
        locationOrLink: locationOrLink.trim() === '' ? null : locationOrLink,
        format,
        type,
        capacity,
      })

      if (!result.ok || !result.eventId) {
        setError(result.error ?? 'That event could not be created.')
        return
      }
      router.push(eventPath(result.eventId))
    } catch {
      setError('That event could not be created. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[640px] px-4 py-10 sm:px-6">
        <Link
          href={ROUTES.events}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <ArrowLeft className="size-3.5" /> Back to events
        </Link>

        <div className="mb-1 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--cx-text-4)]">
            Events
          </p>
        </div>
        <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          Create an event
        </h1>
        <p className="mb-8 mt-1 text-sm text-[var(--cx-text-3)]">
          Create something worth gathering for.
        </p>

        <form
          className="space-y-4 rounded-[24px] border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 sm:p-6"
          onSubmit={handleSubmit}
        >
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Event title
            </span>
            <Input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your event"
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
              placeholder="What will people do, and why should they come?"
              disabled={saving}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Starts at
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 focus-within:border-[var(--cx-brand)]">
                <CalendarDays className="size-4 text-[var(--cx-text-4)]" />
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={saving}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Format
              </span>
              <div className="flex items-center gap-2 rounded-2xl border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 focus-within:border-[var(--cx-brand)]">
                <Ticket className="size-4 text-[var(--cx-text-4)]" />
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  disabled={saving}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Type
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'virtual' | 'irl')}
                disabled={saving}
                className="w-full rounded-2xl border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--cx-brand)]"
              >
                <option value="virtual">Virtual</option>
                <option value="irl">In person</option>
              </select>
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
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Location or link
            </span>
            <div className="flex items-center gap-2 rounded-2xl border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 focus-within:border-[var(--cx-brand)]">
              <MapPin className="size-4 text-[var(--cx-text-4)]" />
              <input
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                placeholder="Online, or a city and venue"
                disabled={saving}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cx-text-4)]"
              />
            </div>
          </label>

          {error ? (
            <p role="alert" className="text-xs text-[var(--cx-danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={saving}>
            <Plus className="size-4" /> {saving ? 'Creating…' : 'Create event'}
          </Button>
        </form>
      </div>
    </div>
  )
}
