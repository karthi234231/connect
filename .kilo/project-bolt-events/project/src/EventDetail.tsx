import { CalendarDays, Check, MapPin, Plus, X, Users, Clock, Video, MapPinned } from 'lucide-react';
import type { EventItem } from './eventsData';

interface EventDetailProps {
  event: EventItem & { month: string; date: string };
  saved: boolean;
  registered: boolean;
  onSave: () => void;
  onRegister: () => void;
  onClose: () => void;
}

export function EventDetail({ event, saved, registered, onSave, onRegister, onClose }: EventDetailProps) {
  const spotsLeft = event.capacity - event.attendees;
  const fillPercent = Math.round((event.attendees / event.capacity) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-2 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="cx-dialog-enter max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-[26px] border border-white/15 bg-[var(--cx-surface-1)] shadow-[0_28px_90px_rgba(0,0,0,.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header banner */}
        <div className={`relative h-36 overflow-hidden bg-gradient-to-br p-3 ${event.tone}`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -right-8 -top-12 size-40 rounded-full border-[16px] border-white/15" />
          <div className="absolute bottom-[-40px] left-1/4 size-32 rounded-full bg-white/10 blur-xl" />
          <div className="relative flex justify-between">
            <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold tracking-[.1em] text-[#322b3a] shadow-sm">
              {event.month} {event.date}
            </span>
            <button
              onClick={onClose}
              aria-label="Close event"
              className="flex size-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
              {event.category}
            </span>
            <span className="rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm capitalize">
              {event.type}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--cx-brand-strong)]">
                {event.category} · {event.type}
              </p>
              <h2 className="mt-1 font-display text-2xl leading-tight">{event.title}</h2>
            </div>
            <button
              onClick={onSave}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--cx-border-1)] text-[var(--cx-text-2)] transition hover:border-[var(--cx-border-3)]"
              aria-label={saved ? 'Remove saved event' : 'Save event'}
            >
              {saved ? <Check className="size-4 text-[var(--cx-brand)]" /> : <Plus className="size-4" />}
            </button>
          </div>

          <p className="mt-3 text-sm leading-6 text-[var(--cx-text-2)]">{event.description}</p>

          {/* Info grid */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--cx-text-2)]">
            <div className="rounded-xl bg-[var(--cx-surface-2)] p-3">
              <CalendarDays className="mb-1 size-4 text-[var(--cx-brand)]" />
              {event.month} {event.date}
            </div>
            <div className="rounded-xl bg-[var(--cx-surface-2)] p-3">
              <MapPin className="mb-1 size-4 text-[var(--cx-brand)]" />
              {event.location}
              <span className="block text-[10px] text-[var(--cx-text-4)]">{event.duration}</span>
            </div>
            <div className="rounded-xl bg-[var(--cx-surface-2)] p-3">
              {event.format === 'Online' ? (
                <Video className="mb-1 size-4 text-[var(--cx-brand)]" />
              ) : (
                <MapPinned className="mb-1 size-4 text-[var(--cx-brand)]" />
              )}
              {event.format}
            </div>
            <div className="rounded-xl bg-[var(--cx-surface-2)] p-3">
              <Clock className="mb-1 size-4 text-[var(--cx-brand)]" />
              {event.duration}
            </div>
          </div>

          {/* Tags */}
          {event.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--cx-border-1)] bg-[var(--cx-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--cx-text-3)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Attendance bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--cx-text-3)]">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" />
                {event.attendees} of {event.capacity} going
              </span>
              <span className="text-[var(--cx-text-4)]">{spotsLeft} spots left</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--cx-surface-3)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--cx-brand)] to-[var(--cx-brand-strong)] transition-all duration-500"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--cx-text-3)]">
            Hosted by <span className="font-medium text-[var(--cx-text-1)]">{event.host}</span>
          </p>

          {/* CTA */}
          <button
            onClick={onRegister}
            disabled={spotsLeft <= 0 && !registered}
            className={`mt-5 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition disabled:opacity-50 ${
              registered
                ? 'border border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                : 'bg-[var(--cx-brand)] text-white shadow-[0_10px_26px_rgba(208,164,91,.25)] hover:bg-[var(--cx-brand-strong)]'
            }`}
          >
            {registered ? 'You are going' : spotsLeft <= 0 ? 'Event is full' : 'Register for event'}
          </button>
        </div>
      </div>
    </div>
  );
}
