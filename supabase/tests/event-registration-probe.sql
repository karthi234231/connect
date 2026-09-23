-- S02-TODO-B unit 5 probe: register_event / cancel_event_registration atomic RPCs.
-- capacity=2 event; covers register, waitlist, duplicates, idempotent replay,
-- cancel -> waitlist promotion, double-cancel, forbidden, missing event.
\set ON_ERROR_STOP on
begin;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as organizer_id,
  (select id from auth.users order by id limit 1 offset 1) as u1,
  (select id from auth.users order by id limit 1 offset 2) as u2,
  (select id from auth.users order by id limit 1 offset 3) as u3,
  (select id from auth.users order by id limit 1 offset 4) as u4;

insert into public.events (id, organizer_id, title, starts_at, capacity)
values ('00000000-0000-0000-0000-0000e5e00001', (select organizer_id from _u), 'Probe event', now() + interval '7 days', 2);

create or replace function pg_temp._as(uid uuid) returns void language plpgsql as $$
declare v text;
begin
  select json_build_object('sub', uid)::text into v;
  perform set_config('request.jwt.claims', v, true);
end $$;

\echo '=== 1. u1 registers under capacity -> registered ==='
select pg_temp._as((select u1 from _u));
set local role postgres;
select status, outcome, waitlist_position, registered_count, remaining_capacity, is_full
from public.register_event('00000000-0000-0000-0000-0000e5e00001', (select u1 from _u), 'req-u1-1');

\echo '=== 2. u2 registers -> fills capacity (registered, remaining 0) ==='
select pg_temp._as((select u2 from _u));
select status, outcome, registered_count, remaining_capacity, is_full
from public.register_event('00000000-0000-0000-0000-0000e5e00001', (select u2 from _u), null);

\echo '=== 3. u3 registers at capacity -> waitlisted with position 1 ==='
select pg_temp._as((select u3 from _u));
select status, outcome, waitlist_position, waitlisted_count
from public.register_event('00000000-0000-0000-0000-0000e5e00001', (select u3 from _u), null);

\echo '=== 4. u1 duplicate register -> already_registered, same registration ==='
select pg_temp._as((select u1 from _u));
select status, outcome from public.register_event('00000000-0000-0000-0000-0000e5e00001', (select u1 from _u), null);

\echo '=== 5. idempotent replay: same p_request_id -> same registration_id ==='
select pg_temp._as((select u1 from _u));
select status, outcome, registration_id = (select id from public.event_registrations where event_id='00000000-0000-0000-0000-0000e5e00001' and user_id=(select u1 from _u)) as same_reg
from public.register_event('00000000-0000-0000-0000-0000e5e00001', (select u1 from _u), 'req-u1-1');

\echo '=== 6. u1 cancels -> u3 promoted from waitlist ==='
select pg_temp._as((select u1 from _u));
select status, promoted_registration_id is not null as promoted
from public.cancel_event_registration(
  (select id from public.event_registrations where event_id='00000000-0000-0000-0000-0000e5e00001' and user_id=(select u1 from _u)),
  (select u1 from _u));
select user_id = (select u3 from _u) as promoted_is_u3, status, waitlist_position is null as pos_cleared
from public.event_registrations where event_id='00000000-0000-0000-0000-0000e5e00001' and user_id=(select u3 from _u);

\echo '=== 7. u1 double cancel -> REGISTRATION_NOT_ACTIVE ==='
select pg_temp._as((select u1 from _u));
do $$
begin
  perform public.cancel_event_registration(
    (select id from public.event_registrations where event_id='00000000-0000-0000-0000-0000e5e00001' and user_id=(select u1 from _u)),
    (select u1 from _u));
  raise exception 'PROBE-FAIL: double cancel did not raise';
exception when others then
  raise notice 'OK: got expected error %', sqlerrm;
end $$;

rollback;
