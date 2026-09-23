-- #103/#104 — event analytics via SQL aggregation instead of loading every
-- registration row. Complexity depends on aggregate size, not registration
-- count; daily grouping uses the EVENT's timezone so the organizer's local
-- calendar day is correct (timestamp AT TIME ZONE event.timezone).
create or replace function public.event_registration_analytics(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer uuid;
  v_tz text;
  v_result jsonb;
begin
  select organizer_id, coalesce(nullif(trim(timezone), ''), 'UTC')
    into v_organizer, v_tz
  from public.events
  where id = p_event_id;

  if v_organizer is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  -- Organizer-only (defense in depth; the service also gates).
  if v_organizer <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'registered', count(*) filter (where status in ('registered','checked_in','no_show')),
    'waitlisted', count(*) filter (where status = 'waitlisted'),
    'cancelled',  count(*) filter (where status = 'cancelled'),
    'checked_in', count(*) filter (where checked_in_at is not null),
    'no_show',    count(*) filter (where status = 'no_show'),
    'by_day', (
      select coalesce(jsonb_object_agg(day, n), '{}'::jsonb)
      from (
        select to_char(registered_at at time zone v_tz, 'YYYY-MM-DD') as day,
               count(*) as n
        from public.event_registrations r
        where r.event_id = p_event_id
          and r.registered_at is not null
        group by 1
      ) d
    )
  )
  into v_result
  from public.event_registrations
  where event_id = p_event_id;

  return coalesce(v_result, jsonb_build_object(
    'registered', 0, 'waitlisted', 0, 'cancelled', 0,
    'checked_in', 0, 'no_show', 0, 'by_day', '{}'::jsonb));
end;
$$;

revoke all on function public.event_registration_analytics(uuid) from public, anon;
grant execute on function public.event_registration_analytics(uuid) to authenticated;