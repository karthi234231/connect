-- Audit #67/#68: single critical round trip for event registration.
-- register_event already performs identity, duplicate, capacity, waitlist,
-- insert and idempotency (read + write) atomically inside one transaction.
-- This wrapper returns the FULL authoritative registration row + result in
-- the same round trip, so the service no longer needs pre-checks, a separate
-- idempotency persist, or a post-RPC readback.
create or replace function public.register_event_full(
  p_event_id  uuid,
  p_user_id   uuid,
  p_request_id text default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'registration',              to_jsonb(r.*),
    'outcome',                   x.outcome,
    'waitlist_position',         x.waitlist_position,
    'registered_count',          x.registered_count,
    'waitlisted_count',          x.waitlisted_count,
    'capacity',                  x.capacity,
    'remaining_capacity',        x.remaining_capacity,
    'spots_remaining',           x.spots_remaining,
    'is_full',                   x.is_full,
    'promoted_registration_id',  x.promoted_registration_id
  )
  from public.register_event(p_event_id, p_user_id, p_request_id) x
  join public.event_registrations r on r.id = x.registration_id
$$;

revoke execute on function public.register_event_full(uuid, uuid, text) from anon;
grant execute on function public.register_event_full(uuid, uuid, text) to authenticated;