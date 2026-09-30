import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Check, Filter, MapPin, Plus, Search, X, AlertCircle, Loader2 } from 'lucide-react';
import {
  type EventItem,
  type FilterOption,
  type NewEventInput,
  categories,
  filterOptions,
} from './eventsData';
import { EventCard, EventCardSkeleton } from './EventCard';
import { EventDetail } from './EventDetail';
import { AddEventForm } from './AddEventForm';
import { fetchEvents, createEvent, incrementAttendees, decrementAttendees } from './eventsService';

type EventSpace = 'browse' | 'going' | 'saved' | 'past';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDateParts(dateStr: string): { month: string; date: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { month: '---', date: '--' };
  return { month: MONTHS[d.getMonth()], date: String(d.getDate()).padStart(2, '0') };
}

export function EventsView() {
  const [filter, setFilter] = useState<FilterOption>('For you');
  const [saved, setSaved] = useState<string[]>([]);
  const [registered, setRegistered] = useState<string[]>([]);
  const [selected, setSelected] = useState<(EventItem & { month: string; date: string }) | null>(null);
  const [eventSpace, setEventSpace] = useState<EventSpace>('browse');
  const [showAddForm, setShowAddForm] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch {
      setError('Could not load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected]);

  const toggleSaved = (id: string) =>
    setSaved((items) => (items.includes(id) ? items.filter((x) => x !== id) : [...items, id]));

  const toggleRegistered = useCallback(
    async (id: string) => {
      const isRegistered = registered.includes(id);
      if (isRegistered) {
        setRegistered((items) => items.filter((x) => x !== id));
        try {
          await decrementAttendees(id);
          setEvents((prev) =>
            prev.map((e) => (e.id === id ? { ...e, attendees: Math.max(0, e.attendees - 1) } : e)),
          );
          if (selected?.id === id) {
            setSelected((prev) => (prev ? { ...prev, attendees: Math.max(0, prev.attendees - 1) } : prev));
          }
        } catch {
          setRegistered((items) => [...items, id]);
        }
      } else {
        setRegistered((items) => [...items, id]);
        try {
          await incrementAttendees(id);
          setEvents((prev) =>
            prev.map((e) => (e.id === id ? { ...e, attendees: Math.min(e.capacity, e.attendees + 1) } : e)),
          );
          if (selected?.id === id) {
            setSelected((prev) => (prev ? { ...prev, attendees: Math.min(prev.capacity, prev.attendees + 1) } : prev));
          }
        } catch {
          setRegistered((items) => items.filter((x) => x !== id));
        }
      }
    },
    [registered, selected],
  );

  const handleCreateEvent = async (input: NewEventInput) => {
    const newEvent = await createEvent(input);
    setEvents((prev) => [...prev, newEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
  };

  const visible = filter === 'Online' ? events.filter((e) => e.format === 'Online') : events;
  const goingEvents = events.filter((e) => registered.includes(e.id));
  const savedEvents = events.filter((e) => saved.includes(e.id));

  // ---- "Your events" sub-view ----
  if (eventSpace !== 'browse') {
    const list = eventSpace === 'going' ? goingEvents : savedEvents;
    return (
      <div className="cx-page-enter flex min-h-[calc(100svh-112px)] flex-col">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setEventSpace('browse')}
            className="text-xs font-medium text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
          >
            ← Back to events
          </button>
          <CalendarDays className="size-4 text-[var(--cx-brand)]" />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[22px] font-semibold tracking-[-.04em]">Your events</h1>
          <Search className="size-4 text-[var(--cx-text-3)]" />
        </div>
        <div className="mt-4 flex gap-2">
          {(['going', 'saved', 'past'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setEventSpace(tab)}
              className={`rounded-full px-4 py-2 text-[11px] font-medium capitalize transition ${
                eventSpace === tab
                  ? 'bg-[var(--cx-brand)] text-[var(--cx-bg)]'
                  : 'bg-[var(--cx-surface-2)] text-[var(--cx-text-2)] hover:bg-[var(--cx-surface-3)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {eventSpace === 'past' || list.length === 0 ? (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-[28px] bg-[var(--cx-brand-soft)] text-[var(--cx-brand)]">
              <CalendarDays className="size-9" />
            </div>
            <h2 className="text-sm font-semibold">No plans yet? Let's fix that</h2>
            <p className="mt-2 max-w-[220px] text-xs leading-5 text-[var(--cx-text-3)]">
              Explore fresh events and find something exciting to join.
            </p>
            <button
              onClick={() => setEventSpace('browse')}
              className="mt-4 rounded-full bg-[var(--cx-text-1)] px-4 py-2 text-[11px] font-medium text-[var(--cx-bg)] transition hover:opacity-90"
            >
              Discover events
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5">
            {list.map((event) => {
              const { month, date } = formatDateParts(event.event_date);
              return (
                <EventCard
                  key={event.id}
                  event={{ ...event, month, date }}
                  saved={saved.includes(event.id)}
                  registered={registered.includes(event.id)}
                  onSave={() => toggleSaved(event.id)}
                  onRegister={() => toggleRegistered(event.id)}
                  onOpen={() => setSelected({ ...event, month, date })}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- Browse view ----
  return (
    <div className="cx-page-enter">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--cx-text-4)]">
            Events
          </p>
          <p className="mt-0.5 text-xs text-[var(--cx-text-3)]">
            Create something worth gathering for
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--cx-brand)] px-3 py-2 text-[11px] font-semibold text-[var(--cx-bg)] shadow-sm transition hover:bg-[var(--cx-brand-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cx-brand)]"
          aria-label="Add a new event"
        >
          <Plus className="size-3.5" /> Add event
        </button>
      </div>

      {/* Category rail */}
      <div className="cx-no-scrollbar mb-3 flex gap-4 overflow-x-auto border-b border-[var(--cx-border-1)] px-1 pb-2">
        {categories.map((category, index) => (
          <button
            key={category.label}
            onClick={() => index === 0 && setFilter('For you')}
            className={`group flex w-[66px] shrink-0 flex-col items-center gap-1.5 text-center ${
              index === 0 ? 'border-b-2 border-[var(--cx-brand)]' : ''
            }`}
          >
            <span
              className={`relative flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-xl shadow-sm transition group-hover:-translate-y-0.5 ${category.tone}`}
            >
              <img src={category.image} alt="" className="absolute inset-0 size-full object-cover" />
              <span className="relative drop-shadow-sm">{category.icon}</span>
            </span>
            <span className="w-full truncate text-[9px] font-medium text-[var(--cx-text-2)]">
              {category.label}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setEventSpace('going')}
          aria-label="Show my events"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-3)] transition hover:text-[var(--cx-text-1)]"
        >
          <Filter className="size-3.5" />
        </button>
        <span className="sr-only">My events</span>
        <div className="cx-no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {filterOptions.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition ${
                filter === item
                  ? 'border-[var(--cx-brand)] bg-[var(--cx-brand-soft)] font-medium text-[var(--cx-brand-strong)]'
                  : 'border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] text-[var(--cx-text-3)] hover:border-[var(--cx-border-2)]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Recommended heading */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--cx-text-4)]">
          Recommended events
        </p>
        <span className="text-[11px] text-[var(--cx-text-4)]">{visible.length} nearby</span>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center rounded-[22px] border border-[var(--cx-danger-soft)] bg-[var(--cx-danger-soft)] px-6 py-12 text-center">
          <AlertCircle className="mb-3 size-8 text-[var(--cx-danger)]" />
          <p className="text-sm font-medium text-[var(--cx-danger)]">{error}</p>
          <button
            onClick={loadEvents}
            className="mt-4 rounded-full bg-[var(--cx-text-1)] px-4 py-2 text-[11px] font-medium text-[var(--cx-bg)]"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="grid gap-2.5 md:grid-cols-2">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-[var(--cx-border-1)] bg-[var(--cx-surface-1)] px-6 py-16 text-center">
          <div className="mb-4 flex size-20 items-center justify-center rounded-[28px] bg-[var(--cx-brand-soft)] text-[var(--cx-brand)]">
            <CalendarDays className="size-9" />
          </div>
          <h2 className="text-sm font-semibold">No events yet</h2>
          <p className="mt-2 max-w-[240px] text-xs leading-5 text-[var(--cx-text-3)]">
            Be the first to create something worth gathering for.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--cx-brand)] px-4 py-2 text-[11px] font-semibold text-[var(--cx-bg)] transition hover:bg-[var(--cx-brand-strong)]"
          >
            <Plus className="size-3.5" /> Add event
          </button>
        </div>
      )}

      {/* Event grid */}
      {!loading && !error && visible.length > 0 && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {visible.map((event) => {
            const { month, date } = formatDateParts(event.event_date);
            return (
              <EventCard
                key={event.id}
                event={{ ...event, month, date }}
                saved={saved.includes(event.id)}
                registered={registered.includes(event.id)}
                onSave={() => toggleSaved(event.id)}
                onRegister={() => toggleRegistered(event.id)}
                onOpen={() => setSelected({ ...event, month, date })}
              />
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <EventDetail
          event={selected}
          saved={saved.includes(selected.id)}
          registered={registered.includes(selected.id)}
          onSave={() => toggleSaved(selected.id)}
          onRegister={() => toggleRegistered(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add event form */}
      {showAddForm && (
        <AddEventForm onClose={() => setShowAddForm(false)} onSubmit={handleCreateEvent} />
      )}
    </div>
  );
}

export { CalendarDays, Check, MapPin, Plus, X, Loader2 };
