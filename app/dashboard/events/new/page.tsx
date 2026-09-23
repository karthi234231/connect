'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Globe,
  MapPin,
  Plus,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import { Badge, Button, Chip, Input, NumberInput, Textarea } from '@/components/ui'
import { CoverPicker, PRESET_GRADIENTS } from '@/components/events'
import { createHostedEventAction } from '@/app/actions/hosted-events'
import { ROUTES, eventPath } from '@/config/routes'
import { showSuccessToast } from '@/lib/toast'

const FORMATS = [
  { value: 'social', label: 'Social', icon: '🎉' },
  { value: 'workshop', label: 'Workshop', icon: '🛠️' },
  { value: 'office_hours', label: 'Office hours', icon: '💡' },
  { value: 'build_night', label: 'Build night', icon: '⚡' },
  { value: 'challenge', label: 'Challenge', icon: '🏆' },
  { value: 'coffee', label: 'Coffee', icon: '☕' },
] as const

const PRESET_CATEGORIES = [
  'General',
  'Founders',
  'AI & Tech',
  'Engineering',
  'Design',
  'Networking',
  'Product',
] as const

function getDefaultStartsAt(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(18, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`
}

export default function NewEventPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(getDefaultStartsAt)
  const [locationOrLink, setLocationOrLink] = useState('Online')
  const [capacity, setCapacity] = useState(50)
  const [format, setFormat] = useState<string>('social')
  const [category, setCategory] = useState<string>('General')
  const [type, setType] = useState<'virtual' | 'irl'>('virtual')
  const [coverImage, setCoverImage] = useState<string>(PRESET_GRADIENTS[0].value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Form Field Validation Messages
  const titleError =
    touched.title && title.trim().length < 3
      ? 'Title must be at least 3 characters long.'
      : null

  const startsAtError =
    touched.startsAt && (!startsAt || isNaN(new Date(startsAt).getTime()))
      ? 'Please select a valid starting date and time.'
      : null

  const handleTypeChange = (newType: 'virtual' | 'irl') => {
    setType(newType)
    if (newType === 'virtual' && (!locationOrLink || locationOrLink === '')) {
      setLocationOrLink('Online')
    } else if (newType === 'irl' && locationOrLink === 'Online') {
      setLocationOrLink('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched({ title: true, startsAt: true })

    if (title.trim().length < 3) {
      setError('Event title must be at least 3 characters long.')
      return
    }

    if (!startsAt || isNaN(new Date(startsAt).getTime())) {
      setError('Please choose a valid date and time.')
      return
    }

    if (saving) return
    setError(null)

    const iso = new Date(startsAt).toISOString()

    setSaving(true)
    try {
      const result = await createHostedEventAction({
        title: title.trim(),
        description: description.trim() === '' ? null : description.trim(),
        startsAt: iso,
        locationOrLink: locationOrLink.trim() === '' ? null : locationOrLink.trim(),
        format,
        type,
        capacity,
        category: category.toLowerCase(),
        coverImage,
      })

      if (!result.ok || !result.eventId) {
        setError(result.error ?? 'That event could not be created.')
        return
      }

      showSuccessToast('Gathering created! Redirecting to event page...')
      router.push(eventPath(result.eventId))
    } catch {
      setError('That event could not be created. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cx-page-enter">
      <div className="mx-auto max-w-[680px] px-4 py-10 sm:px-6">
        <Link
          href={ROUTES.events}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <ArrowLeft className="size-3.5" /> Back to gatherings
        </Link>

        <div className="mb-1 flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--cx-brand-strong)]">
            Gatherings
          </p>
          <Badge variant="brand">
            <Sparkles className="size-3" />
            Host Event
          </Badge>
        </div>
        <h1 className="font-display text-[23px] font-semibold leading-tight tracking-[-.045em] sm:text-[32px]">
          Create a gathering
        </h1>
        <p className="mb-8 mt-1 text-sm text-[var(--cx-text-3)]">
          Host a meetup, workshop, or build night to bring aligned people together.
        </p>

        <form
          className="space-y-6 rounded-[24px] border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] p-5 shadow-[var(--cx-shadow-card)] sm:p-6"
          onSubmit={handleSubmit}
        >
          {/* Cover Picker */}
          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Cover Image & Theme
            </label>
            <CoverPicker
              value={coverImage}
              onChange={setCoverImage}
              previewTitle={title}
              disabled={saving}
            />
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Event title <span className="text-[var(--cx-danger)]">*</span>
            </label>
            <Input
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTouched((prev) => ({ ...prev, title: true }))
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
              placeholder="e.g. Founder Coffee & Build Session"
              disabled={saving}
              className={titleError ? 'border-[var(--cx-danger)]' : ''}
            />
            {titleError && (
              <p className="mt-1 text-xs text-[var(--cx-danger)]">{titleError}</p>
            )}
          </div>

          {/* Format & Category Selectors */}
          <div className="space-y-3">
            <label className="block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Format <span className="text-[var(--cx-danger)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => (
                <button
                  type="button"
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  disabled={saving}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    format === f.value
                      ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                      : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:border-[var(--cx-border-2)]'
                  }`}
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-xs">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Pills */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Category
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  active={category.toLowerCase() === cat.toLowerCase()}
                  onClick={() => setCategory(cat)}
                  className="cursor-pointer text-xs"
                >
                  {cat}
                </Chip>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
              Description
            </label>
            <Textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will people do, and why should they join?"
              disabled={saving}
            />
          </div>

          {/* Start Date & Capacity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Starts at <span className="text-[var(--cx-danger)]">*</span>
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 focus-within:border-[var(--cx-brand)]">
                <CalendarDays className="size-4 text-[var(--cx-brand)]" />
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => {
                    setStartsAt(e.target.value)
                    setTouched((prev) => ({ ...prev, startsAt: true }))
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, startsAt: true }))}
                  disabled={saving}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none text-[var(--cx-text-1)]"
                />
              </div>
              {startsAtError && (
                <p className="mt-1 text-xs text-[var(--cx-danger)]">
                  {startsAtError}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Capacity (spots)
              </label>
              <div className="flex items-center gap-2">
                <NumberInput
                  min={1}
                  max={10000}
                  value={capacity}
                  onValueChange={setCapacity}
                  disabled={saving}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {[20, 50, 100].map((cap) => (
                    <button
                      type="button"
                      key={cap}
                      onClick={() => setCapacity(cap)}
                      disabled={saving}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium transition border ${
                        capacity === cap
                          ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                          : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-3)] hover:text-[var(--cx-text-1)]'
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Type (Virtual vs IRL) & Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Gathering Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('virtual')}
                  disabled={saving}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                    type === 'virtual'
                      ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                      : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:border-[var(--cx-border-2)]'
                  }`}
                >
                  <Globe className="size-3.5" /> Virtual
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('irl')}
                  disabled={saving}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition ${
                    type === 'irl'
                      ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)] font-semibold'
                      : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:border-[var(--cx-border-2)]'
                  }`}
                >
                  <MapPin className="size-3.5" /> In Person
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-text-4)]">
                Location or Link
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 focus-within:border-[var(--cx-brand)]">
                <MapPin className="size-4 text-[var(--cx-brand)]" />
                <input
                  value={locationOrLink}
                  onChange={(e) => setLocationOrLink(e.target.value)}
                  placeholder={
                    type === 'virtual'
                      ? 'Online (Zoom, Google Meet, or Discord)'
                      : 'Venue address or city'
                  }
                  disabled={saving}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cx-text-4)] text-[var(--cx-text-1)]"
                />
              </div>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-xs font-medium text-[var(--cx-danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">Creating gathering…</span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="size-4" /> Create Gathering
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
