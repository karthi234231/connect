import { Check, MapPin, Plus } from 'lucide-react';
import type { EventItem } from './eventsData';

interface EventCardProps {
  event: EventItem & { month: string; date: string };
  saved: boolean;
  registered: boolean;
  onSave: () => void;
  onRegister: () => void;
  onOpen: () => void;
}

export function EventCard({ event, saved, registered, onSave, onRegister, onOpen }: EventCardProps) {
  const spotsLeft = event.capacity - event.attendees;

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] shadow-[0_10px_28px_rgba(0,0,0,.14)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,.22)]">
      <button
        onClick={onOpen}
        className={`relative flex h-[118px] w-full items-end overflow-hidden bg-gradient-to-br p-3 text-left ${event.tone}`}
        aria-label={`View ${event.title}`}
      >
        <div className="absolute -right-5 -top-8 size-28 rounded-full border-[14px] border-white/20" />
        <div className="absolute bottom-[-35px] left-1/3 size-28 rounded-full bg-white/15 blur-xl" />
        <div className="relative flex w-full items-end justify-between">
          <span className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold tracking-[.1em] text-[#322b3a] shadow-sm">
            {event.month} {event.date}
          </span>
          <span className="rounded-full bg-black/20 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
            {event.category}
          </span>
        </div>
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpen} className="min-w-0 text-left">
            <h2 className="font-display text-[17px] leading-tight tracking-[-.02em]">{event.title}</h2>
            <p className="mt-1 text-[11px] font-medium text-[var(--cx-text-2)]">{event.host}</p>
          </button>
          <button
            onClick={onSave}
            aria-label={saved ? 'Remove saved event' : 'Save event'}
            className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition ${
              saved
                ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                : 'border-[var(--cx-border-1)] text-[var(--cx-text-3)] hover:border-[var(--cx-border-3)]'
            }`}
          >
            {saved ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--cx-text-3)]">
          <MapPin className="size-3 shrink-0" />
          {event.location} · {event.duration}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--cx-border-1)] pt-2.5">
          <span className="text-[10px] text-[var(--cx-text-4)]">
            {event.attendees} going · {spotsLeft} spots left
          </span>
          <button
            onClick={onRegister}
            disabled={spotsLeft <= 0 && !registered}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition disabled:opacity-40 ${
              registered
                ? 'bg-[var(--cx-brand-soft)] text-[var(--cx-brand-strong)]'
                : 'bg-[var(--cx-brand)] text-white hover:bg-[var(--cx-brand-strong)]'
            }`}
          >
            {registered ? 'Going' : spotsLeft <= 0 ? 'Full' : 'Register'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)]">
      <div className="cx-skeleton h-[118px] w-full" />
      <div className="space-y-2 p-3">
        <div className="cx-skeleton h-4 w-3/4" />
        <div className="cx-skeleton h-3 w-1/2" />
        <div className="cx-skeleton mt-3 h-3 w-2/3" />
      </div>
    </div>
  );
}
