import { useState } from 'react';
import { X, Calendar, MapPin, User, Clock, Tag, Plus, Loader2 } from 'lucide-react';
import {
  type NewEventInput,
  type EventFormat,
  type EventType,
  eventTypes,
  eventFormats,
  toneOptions,
  categoryOptions,
} from './eventsData';

interface AddEventFormProps {
  onClose: () => void;
  onSubmit: (input: NewEventInput) => Promise<void>;
}

export function AddEventForm({ onClose, onSubmit }: AddEventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState<EventFormat>('Online');
  const [duration, setDuration] = useState('60 min');
  const [capacity, setCapacity] = useState(50);
  const [category, setCategory] = useState(categoryOptions[0]);
  const [type, setType] = useState<EventType>('workshop');
  const [tone, setTone] = useState(toneOptions[0].value);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 6) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !host.trim() || !location.trim() || !eventDate) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        host: host.trim(),
        location: location.trim(),
        format,
        duration,
        capacity,
        category,
        type,
        tone,
        tags,
        event_date: eventDate,
      });
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-3 py-2.5 text-sm text-[var(--cx-text-1)] placeholder:text-[var(--cx-text-4)] transition focus:border-[var(--cx-brand)] focus:outline-none';

  const labelClass =
    'mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--cx-text-3)]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-2 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a new event"
        className="cx-dialog-enter max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/15 bg-[var(--cx-surface-1)] shadow-[0_28px_90px_rgba(0,0,0,.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`relative h-28 overflow-hidden bg-gradient-to-br p-3 ${tone}`}>
          <div className="absolute -right-8 -top-12 size-36 rounded-full border-[14px] border-white/15" />
          <div className="relative flex items-center justify-between">
            <h2 className="font-display text-xl text-white">Create an event</h2>
            <button
              onClick={onClose}
              aria-label="Close form"
              className="flex size-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          {/* Title */}
          <div>
            <label className={labelClass}>
              <Tag className="size-3" /> Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your event a name"
              className={fieldClass}
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this event about?"
              rows={3}
              className={`${fieldClass} resize-none`}
              maxLength={500}
            />
          </div>

          {/* Host + Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <User className="size-3" /> Host
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="Who is hosting?"
                className={fieldClass}
                maxLength={60}
              />
            </div>
            <div>
              <label className={labelClass}>
                <MapPin className="size-3" /> Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where is it?"
                className={fieldClass}
                maxLength={80}
              />
            </div>
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                <Calendar className="size-3" /> Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                <Clock className="size-3" /> Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 90 min, 2 hrs"
                className={fieldClass}
                maxLength={20}
              />
            </div>
          </div>

          {/* Format + Capacity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Format</label>
              <div className="flex gap-2">
                {eventFormats.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      format === f
                        ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                        : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-3)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={1000}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Category + Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={fieldClass}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType)}
                className={fieldClass}
              >
                {eventTypes.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tone picker */}
          <div>
            <label className={labelClass}>Card color</label>
            <div className="flex flex-wrap gap-2">
              {toneOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  aria-label={t.label}
                  className={`h-9 w-12 rounded-lg bg-gradient-to-br transition ${t.value} ${
                    tone === t.value
                      ? 'ring-2 ring-[var(--cx-brand)] ring-offset-2 ring-offset-[var(--cx-surface-1)]'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>Tags (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
                className={fieldClass}
                maxLength={20}
              />
              <button
                type="button"
                onClick={addTag}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
                aria-label="Add tag"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-3)]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="text-[var(--cx-text-4)] hover:text-[var(--cx-danger)]"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl bg-[var(--cx-danger-soft)] px-3 py-2 text-xs text-[var(--cx-danger)]">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--cx-brand)] text-sm font-semibold text-[var(--cx-bg)] shadow-[0_10px_26px_rgba(208,164,91,.25)] transition hover:bg-[var(--cx-brand-strong)] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating...
              </>
            ) : (
              'Create event'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
