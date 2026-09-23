-- =====================================================================
-- E2E seed: Connections + notifications for the real test user.
-- Target user: b16b5b49-e640-4dbb-ab17-77bb3064d65f
--               (jogikarthik123@gmail.com, "Karthik Jogi")
--
-- Seeds a realistic people & inbox state:
--   1. connection_requests - incoming pending (Grace, Isla), outgoing
--      pending (Alice, Kate), accepted history (Carla, John, Bob),
--      declined (Henry).
--   2. notifications        - 8-row mixed inbox covering all five types,
--      newest 3 unread so the bell shows a badge.
--   3. notification_preferences - per-type channel matrix (5 rows).
--   4. notification_settings - quiet hours off, daily digest at 9 IST.
--   5. notification_deliveries - outbox: 2 sent (email + push), 1 pending.
--   6. alerts               - info "Welcome to Connect", unacknowledged
--      security alert (new device login).
--
-- No grants, no auth.users, no DDL. Plain DML only.
-- Idempotent: scoped DELETE for the target user up top, then fresh
-- inserts guarded by ON CONFLICT on the natural keys.
-- =====================================================================

-- 0. Scoped delete (target user only, never global) --------------------
delete from public.connection_requests
 where requester_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'
    or addressee_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

delete from public.notifications
 where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

delete from public.notification_preferences
 where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

delete from public.notification_settings
 where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

delete from public.notification_deliveries
 where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'
    or notification_id in (
         select id from public.notifications
          where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'
       );

delete from public.alerts
 where user_id = 'b16b5b49-e640-4dbb-ab17-77bb3064d65f';

-- 1. connection_requests ------------------------------------------------
-- constraint: connection_requests_pair_unique (requester_id, addressee_id)
insert into public.connection_requests
  (id, requester_id, addressee_id, status, message, responded_at, created_at, updated_at)
values
  -- incoming pending (unanswered inbox requests)
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'pending', 'Your Connect profile caught my eye - want to brainstorm the matching engine?', null, now() - interval '6 hours', now() - interval '6 hours'),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000009', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'pending', 'Loved your founder profile. Happy to chip in on product design.', null, now() - interval '1 day', now() - interval '1 day'),
  -- outgoing pending (awaiting their answer)
  ('c0000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000001', 'pending', 'Your UPI credit rails idea overlaps with what I''m building. Coffee chat?', null, now() - interval '3 days', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000b', 'pending', 'Saw your mobile work - want to team up on the Connect app?', null, now() - interval '18 hours', now() - interval '18 hours'),
  -- accepted history
  ('c0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'accepted', 'Your fintech focus matches my design work. Let''s connect.', now() - interval '7 days', now() - interval '8 days', now() - interval '7 days'),
  ('c0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'accepted', 'Backend nerd here - happy to talk shop on ideas.', now() - interval '4 days', now() - interval '5 days', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'accepted', 'Enjoyed your write-up on founder-engineer matching.', now() - interval '9 days', now() - interval '10 days', now() - interval '9 days'),
  -- declined
  ('c0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000008', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'declined', 'Busy this quarter but wanted to say hi.', now() - interval '3 days', now() - interval '4 days', now() - interval '3 days')
on conflict (requester_id, addressee_id) do nothing;

-- 2. notifications -------------------------------------------------------
-- 5 read (older), 3 newest unread (badge = 3). All five types covered.
insert into public.notifications
  (id, user_id, type, entity_type, entity_id, title, body, read_at, dedupe_key, expires_at, created_at)
values
  -- match_created (read)
  ('c2000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'match_created', 'match', 'b0000000-0000-0000-0000-000000000001', 'You matched with Carla Mendes', 'Product designer in São Paulo - 88% match. Open to 0-1 work.', now() - interval '4 days', 'match:created:b0000000-0000-0000-0000-000000000001', now() + interval '30 days', now() - interval '5 days'),
  -- match_created (read)
  ('c2000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'match_created', 'match', 'b0000000-0000-0000-0000-000000000002', 'You matched with John Park', 'Backend engineer in Seoul - 81% match. Nights and weekends.', now() - interval '2 days', 'match:created:b0000000-0000-0000-0000-000000000002', now() + interval '30 days', now() - interval '3 days'),
  -- message_received (read)
  ('c2000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'message_received', 'message', 'b2000000-0000-0000-0000-000000000003', 'Alice Chen sent you a message', 'Hey Karthik! Your UPI credit rails idea is exactly the problem I wanted to work on.', now() - interval '1 day', 'message:received:b2000000-0000-0000-0000-000000000003', now() + interval '30 days', now() - interval '2 days'),
  -- intro_requested (read)
  ('c2000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'intro_requested', 'match', 'b0000000-0000-0000-0000-000000000003', 'Bob Okafor wants an intro', 'He''d like a warm introduction to Carla Mendes - you''re the shared connection.', now() - interval '12 hours', 'intro:requested:b0000000-0000-0000-0000-000000000003', now() + interval '30 days', now() - interval '1 day'),
  -- event_group_assigned (read)
  ('c2000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'event_group_assigned', 'event', 'd0000000-0000-0000-0000-000000000001', 'You were placed in Table A at Bangalore Builders Meetup', 'Join your group for the networking round - 6 people per table.', now() - interval '6 hours', 'event:assigned:d0000000-0000-0000-0000-000000000001', now() + interval '30 days', now() - interval '12 hours'),
  -- event_reminder (UNREAD)
  ('c2000000-0000-0000-0000-000000000006', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'event_reminder', 'event', 'd0000000-0000-0000-0000-000000000001', 'Bangalore Builders Meetup starts in 3 days', 'You''re going. Venue: WeWork Galaxy, Residency Road, Bengaluru.', null, 'event:reminder:d0000000-0000-0000-0000-000000000001', now() + interval '30 days', now() - interval '6 hours'),
  -- message_received (UNREAD)
  ('c2000000-0000-0000-0000-000000000007', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'message_received', 'message', 'b2000000-0000-0000-0000-000000000006', 'Leo Martins sent you a message', 'Love the Connect concept - want to brainstorm the matching engine together?', null, 'message:received:b2000000-0000-0000-0000-000000000006', now() + interval '30 days', now() - interval '2 hours'),
  -- event_reminder (UNREAD)
  ('c2000000-0000-0000-0000-000000000008', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'event_reminder', 'event', 'd0000000-0000-0000-0000-000000000002', 'Intro to React Server Components starts tomorrow', 'You''re registered. Join link: meet.google.com/rsc-intro-workshop.', null, 'event:reminder:d0000000-0000-0000-0000-000000000002', now() + interval '30 days', now() - interval '30 minutes');

-- 3. notification_preferences -------------------------------------------
-- per-type channel matrix; unique (user_id, type)
insert into public.notification_preferences
  (id, user_id, type, enabled, in_app, email, push, created_at, updated_at)
values
  ('c2500000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'match_created',        true, true,  true,  true,  now() - interval '20 days', now() - interval '20 days'),
  ('c2500000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'message_received',     true, true,  true,  true,  now() - interval '20 days', now() - interval '20 days'),
  ('c2500000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'intro_requested',      true, true,  true,  false, now() - interval '20 days', now() - interval '20 days'),
  ('c2500000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'event_reminder',       true, true,  false, false, now() - interval '20 days', now() - interval '20 days'),
  ('c2500000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'event_group_assigned', true, true,  false, true,  now() - interval '20 days', now() - interval '20 days')
on conflict (user_id, type) do update set
  enabled = excluded.enabled,
  in_app = excluded.in_app,
  email = excluded.email,
  push = excluded.push,
  updated_at = now();

-- 4. notification_settings ----------------------------------------------
-- PK is user_id: quiet hours off, daily digest at 09:00 IST, security on
insert into public.notification_settings
  (user_id, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, digest_cadence, digest_hour, digest_timezone, security_alerts, updated_at)
values
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', false, null, null, 'UTC', 'daily', 9, 'Asia/Kolkata', true, now() - interval '20 days')
on conflict (user_id) do update set
  quiet_hours_enabled = excluded.quiet_hours_enabled,
  quiet_hours_start = excluded.quiet_hours_start,
  quiet_hours_end = excluded.quiet_hours_end,
  quiet_hours_timezone = excluded.quiet_hours_timezone,
  digest_cadence = excluded.digest_cadence,
  digest_hour = excluded.digest_hour,
  digest_timezone = excluded.digest_timezone,
  security_alerts = excluded.security_alerts,
  updated_at = now();

-- 5. notification_deliveries --------------------------------------------
-- outbox: 2 sent (email + push, older), 1 pending (email, enqueued)
insert into public.notification_deliveries
  (id, notification_id, user_id, channel, status, attempts, to_email, provider_message_id, last_error, next_attempt_at, created_at, updated_at)
values
  -- sent email for the Carla match notification
  ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'email', 'sent', 2, 'jogikarthik123@gmail.com', 'provider:sg:match-created-000000000001', null, now() - interval '4 days', now() - interval '5 days', now() - interval '4 days'),
  -- sent push for the Alice message notification
  ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'push', 'sent', 1, null, 'expo:push:message-000000000003', null, now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
  -- pending email for the unread Leo message notification (worker will pick up)
  ('c3000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000007', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'email', 'pending', 0, 'jogikarthik123@gmail.com', null, null, now(), now() - interval '2 hours', now() - interval '2 hours');

-- 6. alerts --------------------------------------------------------------
-- unique (user_id, dedupe_key); security alert intentionally unacknowledged
insert into public.alerts
  (id, user_id, severity, source, title, body, link, dedupe_key, is_security, expires_at, acknowledged_at, created_at)
values
  ('c4000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'info', 'system', 'Welcome to Connect', 'Complete your profile to get better matches.', '/dashboard/profile', 'welcome:connect', false, now() + interval '30 days', now() - interval '20 days', now() - interval '20 days'),
  ('c4000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'critical', 'security', 'New login detected from a new device', 'We noticed a sign-in from a new device in Bengaluru, India. If this wasn''t you, change your password and review active sessions.', '/settings/security', 'security:login:new-device', true, now() + interval '2 days', null, now() - interval '20 minutes');

-- EOF