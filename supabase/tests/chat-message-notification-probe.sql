-- GAP-010 probe: chat message notification trigger.
-- Exercises the trigger path end-to-end (a message INSERT fires
-- trg_chat_message_notify):
--   1. a fresh message creates EXACTLY one message_received notification for
--      the RECIPIENT (other participant), routed to the match (open_chat) and
--      carrying the sender's name + a content preview;
--   2. the SENDER never receives a row;
--   3. the email channel lands as exactly one pending notification_deliveries
--      row (the durable outbox a worker drains) — never an inline send;
--   4. a second message in the same 10-minute dedupe window coalesces (still
--      exactly one row + one delivery, i.e. a badge refresh, no spam);
--   5. an enabled=false + in_app=false preference silences the whole pipeline.
-- Same teardown style as the reference probes: everything runs inside one
-- transaction and ROLLS BACK, so the probe is idempotent and side-effect-free.
\set ON_ERROR_STOP on
begin;

-- 1. Participants: reuse the first two seeded auth.users (reference-probe
--    convention) as sender/recipient and make real profile rows with
--    deterministic display names.
create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as sender,
  (select id from auth.users order by id limit 1 offset 1) as recipient;

insert into public.profiles (id, full_name)
select id,
       case when id = (select sender from _u) then 'Probe Sender' else 'Probe Recipient' end
from auth.users
where id = (select sender from _u)
   or id = (select recipient from _u)
on conflict (id) do update set full_name = excluded.full_name;

-- Any pre-existing pair must not collide with the probe match (canonical
-- delete, same as matches-enforcement-probe). Cascades touch only data created
-- inside this rolled-back transaction.
delete from public.matches
where (user1_id = (select sender from _u) and user2_id = (select recipient from _u))
   or (user1_id = (select recipient from _u) and user2_id = (select sender from _u));

create temp table _m as
with ins as (
  insert into public.matches (user1_id, user2_id, status)
  select (select sender from _u), (select recipient from _u), 'pending'
  returning id
)
select id from ins;

update public.matches
set status = 'active'
where id = (select id from _m);

-- Deterministic quiet hours (off) so the email-channel assertions are stable
-- regardless of a dev user's settings.
insert into public.notification_settings (user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
select (select recipient from _u), false, null, null
on conflict (user_id) do update
  set quiet_hours_enabled = false, quiet_hours_start = null, quiet_hours_end = null;

-- 2. Baseline counts (delta-based, like notification-dedupe-probe).
create temp table _baseline as
select
  (select count(*) from public.notifications where user_id = (select recipient from _u)) as recipient_rows,
  (select count(*) from public.notifications where user_id = (select sender from _u))   as sender_rows,
  (select count(*) from public.notification_deliveries where user_id = (select recipient from _u)) as recipient_deliveries;

\echo '=== 1. first message: exactly one notification for the RECIPIENT ==='
insert into public.messages (match_id, sender_id, content, client_message_id)
select (select id from _m), (select sender from _u), 'Hello from the probe', gen_random_uuid();

do $$
declare v_delta int;
begin
  select count(*) - (select recipient_rows from _baseline)
    into v_delta
    from public.notifications
   where user_id = (select recipient from _u);
  if v_delta <> 1 then
    raise exception 'PROBE-FAIL: recipient expected exactly 1 notification row, got delta %', v_delta;
  end if;
end $$;

\echo '=== 2. row shape: type/entity-routing/title/body/dedupe_key ==='
do $$
declare v_ok int;
begin
  select count(*) into v_ok
  from public.notifications n
  where n.user_id = (select recipient from _u)
    and n.type = 'message_received'
    and n.entity_type = 'match'
    and n.entity_id = (select id from _m)
    and n.title = 'Probe Sender sent you a message'
    and n.body = 'Hello from the probe'
    and n.dedupe_key like 'message_received:' || (select id from _m)::text || ':%';
  if v_ok <> 1 then
    raise exception 'PROBE-FAIL: notification row shape mismatch (count %)', v_ok;
  end if;
end $$;

\echo '=== 3. SENDER gets nothing ==='
do $$
declare v_delta int;
begin
  select count(*) - (select sender_rows from _baseline)
    into v_delta
    from public.notifications
   where user_id = (select sender from _u);
  if v_delta <> 0 then
    raise exception 'PROBE-FAIL: sender received % notification(s)', v_delta;
  end if;
end $$;

\echo '=== 4. email outbox: exactly one pending delivery for the RECIPIENT ==='
do $$
declare v_delta int;
begin
  select count(*) - (select recipient_deliveries from _baseline)
    into v_delta
    from public.notification_deliveries
   where user_id = (select recipient from _u);
  if v_delta <> 1 then
    raise exception 'PROBE-FAIL: expected exactly 1 email delivery row, got delta %', v_delta;
  end if;
end $$;

\echo '=== 5. burst dedupe: a second message in the same window adds nothing ==='
insert into public.messages (match_id, sender_id, content, client_message_id)
select (select id from _m), (select sender from _u), 'Second burst message', gen_random_uuid();

do $$
declare v_delta int;
begin
  select count(*) - (select recipient_rows from _baseline)
    into v_delta
    from public.notifications
   where user_id = (select recipient from _u);
  if v_delta <> 1 then
    raise exception 'PROBE-FAIL: burst should coalesce to 1 notification row, got delta %', v_delta;
  end if;
end $$;

-- the deduped send must not enqueue a second email either
do $$
declare v_delta int;
begin
  select count(*) - (select recipient_deliveries from _baseline)
    into v_delta
    from public.notification_deliveries
   where user_id = (select recipient from _u);
  if v_delta <> 1 then
    raise exception 'PROBE-FAIL: burst should not enqueue a 2nd email, got delta %', v_delta;
  end if;
end $$;

\echo '=== 6. preference off (enabled=false + in_app=false) silences the pipeline ==='
insert into public.notification_preferences (user_id, type, enabled, in_app, email, push)
select (select recipient from _u), 'message_received', false, false, false, false
on conflict (user_id, type) do update
  set enabled = false, in_app = false, email = false, push = false;

insert into public.messages (match_id, sender_id, content, client_message_id)
select (select id from _m), (select sender from _u), 'Silenced message', gen_random_uuid();

do $$
declare v_delta int;
begin
  select count(*) - (select recipient_rows from _baseline)
    into v_delta
    from public.notifications
   where user_id = (select recipient from _u);
  if v_delta <> 1 then
    raise exception 'PROBE-FAIL: disabled preference should add no notification row, got delta %', v_delta;
  end if;
end $$;

\echo '=== summary deltas (recipient_notifications / sender_notifications / recipient_emails) ==='
select
  (select count(*) from public.notifications where user_id = (select recipient from _u)) - (select recipient_rows from _baseline) as recipient_notification_delta,
  (select count(*) from public.notifications where user_id = (select sender from _u)) - (select sender_rows from _baseline) as sender_notification_delta,
  (select count(*) from public.notification_deliveries where user_id = (select recipient from _u)) - (select recipient_deliveries from _baseline) as recipient_email_delta;

rollback;