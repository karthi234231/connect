-- Audit #71: duplicateEvent must be transactional.
-- Previously: event insert + 3 separate copies (media/speakers/agenda) — a
-- partial duplicate could exist on failure. This RPC performs ALL relational
-- copies in ONE transaction; the duplicated event is either fully created or
-- rolled back.
-- Storage note: media rows reference shared storage objects by URL; the copy
-- re-references the same objects, so no storage-side copy is required.
create or replace function public.duplicate_event(
  p_event_id uuid,
  p_user_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source   public.events%rowtype;
  v_new_id   uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_source
  from public.events
  where id = p_event_id and organizer_id = p_user_id;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  insert into public.events (
    organizer_id, title, description, type, format, category, starts_at,
    duration_minutes, capacity, tags, recurrence, recurrence_end, visibility,
    location_or_link, venue, cover_image, timezone, price, currency, status
  ) values (
    p_user_id,
    v_source.title || ' (copy)',
    v_source.description,
    v_source.type,
    v_source.format,
    v_source.category,
    v_source.starts_at,
    v_source.duration_minutes,
    v_source.capacity,
    coalesce(v_source.tags, '{}'::text[]),
    coalesce(v_source.recurrence, 'none'),
    v_source.recurrence_end,
    v_source.visibility,
    v_source.location_or_link,
    v_source.venue,
    v_source.cover_image,
    v_source.timezone,
    coalesce(v_source.price, 0),
    coalesce(v_source.currency, 'INR'),
    'draft'
  )
  returning id into v_new_id;

  -- Relational copies (same transaction as the event insert).
  insert into public.event_media (
    event_id, url, type, alt, width, height, duration_seconds, sort_order
  )
  select
    v_new_id, m.url, m.type, m.alt, m.width, m.height, m.duration_seconds, m.sort_order
  from public.event_media m
  where m.event_id = p_event_id;

  insert into public.event_speakers (
    event_id, name, role, company, avatar_url, bio, profile_url, sort_order
  )
  select
    v_new_id, s.name, s.role, s.company, s.avatar_url, s.bio, s.profile_url, s.sort_order
  from public.event_speakers s
  where s.event_id = p_event_id;

  insert into public.event_agenda (
    event_id, title, description, starts_at, ends_at, duration_minutes
  )
  select
    v_new_id, a.title, a.description, a.starts_at, a.ends_at, a.duration_minutes
  from public.event_agenda a
  where a.event_id = p_event_id;

  return v_new_id;
end;
$$;

revoke execute on function public.duplicate_event(uuid, uuid) from anon;
grant execute on function public.duplicate_event(uuid, uuid) to authenticated;