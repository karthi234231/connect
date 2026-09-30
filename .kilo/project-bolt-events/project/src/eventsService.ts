import { supabase } from './lib/supabase';
import type { EventItem, NewEventInput } from './eventsData';

export async function fetchEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as EventItem[];
}

export async function createEvent(input: NewEventInput): Promise<EventItem> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: input.title,
      description: input.description,
      host: input.host,
      location: input.location,
      format: input.format,
      duration: input.duration,
      capacity: input.capacity,
      category: input.category,
      type: input.type,
      tone: input.tone,
      tags: input.tags,
      event_date: input.event_date,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as EventItem;
}

export async function updateEvent(id: string, patch: Partial<EventItem>): Promise<EventItem> {
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as EventItem;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

export async function incrementAttendees(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_attendees', { event_id: id });
  if (error) throw error;
}

export async function decrementAttendees(id: string): Promise<void> {
  const { error } = await supabase.rpc('decrement_attendees', { event_id: id });
  if (error) throw error;
}
