begin;

-- ============================================================================
-- GAP-010 — "new chat message" notifications.
--
-- The message_received notification type, the preference matrix, the
-- recipient-scoped dedupe index and the durable email outbox ALREADY EXIST
-- (20260903050001_notification_domain, 20260903060000_notification_preferences_matrix,
-- 20260904160000_notification_dedupe_recipient_unique,
-- 20260906170000_notification_deliveries_outbox). The gap: nothing ever EMITS
-- message_received in the chat send path — the seeds only fabricate the rows.
--
-- This trigger closes the gap at the DB boundary so the hot
-- `services/chat/chat.service.ts` sendMessage path stays byte-for-byte
-- unchanged (no added round-trips, atomic with the message commit):
--
--   * fires AFTER a messages INSERT, in the same transaction;
--   * resolves the recipient = the other match participant — the sender, by
--     construction, never receives a row;
--   * honors notification_preferences (master `enabled` toggle + `in_app`
--     channel flag), silently no-oping when disabled — mirrors
--     NotificationsService.notify() and its absent-row defaults (all true for
--     message_received);
--   * treats a burst as one unread thread: a 10-minute windowed dedupe_key
--     (`message_received:<match_id>:<epoch/600>`) plus the existing partial
--     unique index (user_id, dedupe_key) makes the DB the arbiter, so N rapid
--     messages coalesce into exactly one notification row per window — a badge
--     refresh, not a per-message spam;
--   * enqueues the EMAIL channel into the durable notification_deliveries
--     outbox for the existing worker route to drain (never Resend inline —
--     HOST-ASYNC-02 / finding #8), gated on the per-type email flag + quiet
--     hours (notification_settings, timezone-safe with an overnight window),
--     and only when THIS statement actually created the row (a deduped burst
--     is also email-silent).
--
-- RLS/grants: nothing new is created that needs policies or grants.
-- `notifications` already carries self-scoped policies + authenticated grants;
-- `notification_deliveries` is service-role/definer-only by design. The
-- security-definer trigger (owned by postgres, same pattern as
-- trg_chat_thread_on_message) writes both tables on the system's behalf, so
-- the sender's RLS identity is irrelevant.
-- ============================================================================

create or replace function public.trg_chat_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient   uuid;
  v_sender_name text;
  v_enabled     boolean;
  v_in_app      boolean;
  v_email       boolean;
  v_quiet       boolean;
  v_to_email    text;
  v_title       text;
  v_body        text;
  v_dedupe      text;
begin
  -- 1) Recipient = the OTHER participant. A non-participant sender (orphan
  --    write) resolves to NULL and notifies nobody.
  select case
           when m.user1_id = new.sender_id then m.user2_id
           when m.user2_id = new.sender_id then m.user1_id
         end
    into v_recipient
    from public.matches m
   where m.id = new.match_id;

  if v_recipient is null then
    return new;
  end if;

  -- 2) Preference gate — mirrors NotificationsService.notify(): absent row
  --    means the service defaults for message_received (enabled/in_app/email
  --    all true). A zero-row lookup yields NULL into the target variables, so
  --    coalesce back to the defaults.
  select np.enabled, np.in_app, np.email
    into v_enabled, v_in_app, v_email
    from public.notification_preferences np
   where np.user_id = v_recipient
     and np.type   = 'message_received';

  v_enabled := coalesce(v_enabled, true);
  v_in_app  := coalesce(v_in_app,  true);
  v_email   := coalesce(v_email,   true);

  -- notify() returns null before the inbox row when in_app is disabled, so a
  -- disabled chat notification withholds BOTH channels (row + email).
  if not v_enabled or not v_in_app then
    return new;
  end if;

  -- 3) Quiet hours gate the EMAIL channel only (the in-app row is always
  --    fine). Mirrors NotificationsService.isQuietHours(), including the
  --    overnight (start > end) window. A malformed quiet_hours_timezone must
  --    never take down a message send, so the computation degrades to "not
  --    quiet" exactly like the TS try/catch fallback to UTC.
  begin
    select ns.quiet_hours_enabled
           and ns.quiet_hours_start is not null
           and ns.quiet_hours_end   is not null
           and (
             (ns.quiet_hours_start <= ns.quiet_hours_end
               and (now() at time zone coalesce(ns.quiet_hours_timezone, 'UTC'))::time >= ns.quiet_hours_start
               and (now() at time zone coalesce(ns.quiet_hours_timezone, 'UTC'))::time <  ns.quiet_hours_end)
             or
             (ns.quiet_hours_start > ns.quiet_hours_end
               and ((now() at time zone coalesce(ns.quiet_hours_timezone, 'UTC'))::time >= ns.quiet_hours_start
                 or (now() at time zone coalesce(ns.quiet_hours_timezone, 'UTC'))::time <  ns.quiet_hours_end))
           )
      into v_quiet
      from public.notification_settings ns
     where ns.user_id = v_recipient;
  exception
    when others then
      v_quiet := false;
  end;

  v_quiet := coalesce(v_quiet, false);

  -- 4) Recipient email for the durable outbox, resolved once at enqueue time
  --    (mirrors NotificationsService.enqueueEmail). NULL → the worker fails
  --    the delivery visibly instead of sending blind.
  select email
    into v_to_email
    from auth.users
   where id = v_recipient;

  -- 5) Row content: the title carries the sender's public name ('Someone'
  --    fallback mirrors requestIntro's), the body previews the message.
  select full_name
    into v_sender_name
    from public.profiles
   where id = new.sender_id;

  v_title := coalesce(v_sender_name, 'Someone') || ' sent you a message';
  v_body  := left(new.content, 500);

  -- 6) Burst dedupe: one row per (recipient, match) per 10-minute window. The
  --    recipient-scoped partial unique index (user_id, dedupe_key) is the
  --    authoritative arbiter; `on conflict do nothing` collapses a burst and
  --    returns no row, so the email enqueue below also stays silent for the
  --    deduped sends.
  v_dedupe := 'message_received:' || new.match_id::text || ':' ||
              floor(extract(epoch from now()) / 600)::text;

  -- 7) In-app inbox row drives /dashboard/notifications (entity_type='match'
  --    + entity_id=match_id so the actionable resolver routes to open_chat).
  --    The outbox row is written only when this statement created the
  --    notification AND email is eligible AND outside quiet hours.
  with notified as (
    insert into public.notifications
      (user_id, type, entity_type, entity_id, title, body, dedupe_key)
    values
      (v_recipient, 'message_received', 'match', new.match_id, v_title, v_body, v_dedupe)
    on conflict do nothing
    returning id, user_id
  )
  insert into public.notification_deliveries
    (notification_id, user_id, channel, status, to_email)
  select notified.id, notified.user_id, 'email', 'pending', v_to_email
    from notified
   where v_email and not v_quiet;

  return new;
end;
$$;

-- Idempotent swap (triggers have no CREATE OR REPLACE).
drop trigger if exists chat_message_notify on public.messages;
create trigger chat_message_notify
  after insert on public.messages
  for each row execute function public.trg_chat_message_notify();

commit;