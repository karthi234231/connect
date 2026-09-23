-- =====================================================================
-- E2E seed: Events + Ideas engagement for the real test user.
-- Target user: b16b5b49-e640-4dbb-ab17-77bb3064d65f
--               (jogikarthik123@gmail.com, "Karthik Jogi")
--
-- Seeds two verticals so the real user's dashboard has:
--   1. EVENTS — one meetup they organize (Bangalore Builders Meetup) with
--      groups, agenda, speakers, media and attendees; plus two events they
--      attend/registered for (Alice's RSC workshop, Bob's fintech coffee).
--   2. IDEAS — their own flagship idea (Connect) with revisions, team,
--      interest signals and join requests; plus other people's ideas they
--      engaged with via interests, emoji reactions and memberships.
--
-- Schema sources verified live:
--   * 20260806090000_events.sql        - events, event_groups, event_attendees
--   * 20260807000000_ideas.sql         - ideas, idea_interests, join_requests,
--                                        team_memberships
--   * 20260812500000_schema_extras.sql - ideas.image_url
--   * 20260903010000_events_canonical_contract.sql - organizer_id rename,
--     events extension columns, event_registrations / event_agenda /
--     event_speakers / event_media
--   * 20260921030000_idea_revisions.sql - idea_revisions
--   * 20260922000000_idea_reactions.sql - idea_reactions
--
-- Inferred shape follows seeds/dev_data.local.sql conventions.
-- Plain DML only: no DDL, no grants, no auth.users. Idempotent via scoped
-- DELETE + ON CONFLICT on natural keys (deterministic d* / e* ids, no
-- global deletes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Idempotency: clear our deterministic rows (children first).
--    Scoped strictly to the event/idea ids seeded in this file.
-- ---------------------------------------------------------------------
delete from public.event_registrations where event_id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003'
);
delete from public.event_attendees where event_id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003'
);
delete from public.event_agenda where event_id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002'
);
delete from public.event_speakers where event_id = 'd0000000-0000-0000-0000-000000000001';
delete from public.event_media where event_id = 'd0000000-0000-0000-0000-000000000001';
delete from public.event_groups where event_id = 'd0000000-0000-0000-0000-000000000001';
delete from public.events where id in (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003'
);

delete from public.idea_revisions where idea_id in (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004'
);
delete from public.idea_reactions where idea_id in (
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003'
);
delete from public.idea_interests where idea_id in (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004'
);
delete from public.team_memberships where idea_id in (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002'
);
delete from public.join_requests where idea_id = 'e0000000-0000-0000-0000-000000000001';
delete from public.ideas where id in (
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000003',
  'e0000000-0000-0000-0000-000000000004'
);

-- ---------------------------------------------------------------------
-- 1. EVENTS
-- ---------------------------------------------------------------------
-- E1: target organizes (irl/monthly). E2: Alice organizes, target attends.
-- E3: Bob organizes, target registered.
-- Column set matches dev seed + the canonical-contract extensions
-- (status/visibility/category/venue/timezone/price/currency/published_at/
-- registration_open). title/description/capacity/duration honour the
-- tightened checks from 20260903010000 (title 3..100, description null or
-- 10..10000, capacity 1..10000, duration 15..1440).
insert into public.events
  (id, organizer_id, title, description, type, format, location_or_link, starts_at,
   duration_minutes, capacity, tags, recurrence, recurrence_end, venue,
   status, visibility, category, timezone, price, currency, registration_open,
   published_at, created_at, updated_at)
values
  ('d0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f',
   'Bangalore Builders Meetup',
   'Monthly IRL meetup for founders, engineers and designers in Bengaluru. Chai, lightning talks and open networking around curated tables.',
   'irl', 'social', 'WeWork Galaxy, Residency Road, Bengaluru',
   now() + interval '7 days', 180, 50, '["founders","networking","startups"]'::jsonb,
   'monthly', now() + interval '3 months',
   '{"name":"WeWork Galaxy","address":"Residency Road, Bengaluru"}'::jsonb,
   'published', 'public', 'networking', 'Asia/Kolkata', 0, 'INR', true,
   now() - interval '10 days', now() - interval '10 days', now()),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Intro to React Server Components',
   'Hands-on virtual workshop: RSC fundamentals, the server/client boundary, streaming and the common migration traps when moving a Next.js app.',
   'virtual', 'workshop', 'https://meet.google.com/rsc-intro-workshop',
   now() + interval '3 days', 90, 100, '["react","frontend","nextjs"]'::jsonb,
   'none', null, null,
   'published', 'public', 'technology', 'Asia/Kolkata', 0, 'INR', true,
   now() - interval '6 days', now() - interval '6 days', now()),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   'Fintech Founder Coffee',
   'Small-table coffee for pre-seed fintech founders. Eight seats, real conversations about credit, payments and unit economics.',
   'irl', 'coffee', 'Third Wave Coffee, Koramangala, Bengaluru',
   now() + interval '5 days', 60, 8, '["fintech","coffee","founders"]'::jsonb,
   'none', null, '{"name":"Third Wave Coffee","address":"Koramangala, Bengaluru"}'::jsonb,
   'published', 'public', 'business', 'Asia/Kolkata', 0, 'INR', true,
   now() - interval '4 days', now() - interval '4 days', now())
on conflict (id) do nothing;

-- event_groups: two breakout tables for E1.
insert into public.event_groups (id, event_id, label, capacity, created_at) values
  ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Table A', 6, now() - interval '2 days'),
  ('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Table B', 6, now() - interval '2 days')
on conflict (id) do nothing;

-- event_attendees: legacy RSVP list. PK is (event_id, user_id)
-- (20260806090000_events.sql lines 52-59).
insert into public.event_attendees (event_id, user_id, status, group_id, created_at) values
  -- E1 (target organizes; he also joins Table A)
  ('d0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'going', 'd1000000-0000-0000-0000-000000000001', now() - interval '9 days'),
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'going', 'd1000000-0000-0000-0000-000000000002', now() - interval '8 days'),
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'going', 'd1000000-0000-0000-0000-000000000001', now() - interval '7 days'),
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'going', 'd1000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'going', 'd1000000-0000-0000-0000-000000000001', now() - interval '5 days'),
  -- E2 (Alice organizes, target attends)
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'going', null, now() - interval '6 days'),
  ('d0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'going', null, now() - interval '5 days'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'going', null, now() - interval '4 days'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'going', null, now() - interval '3 days'),
  -- E3 (Bob organizes, target registered)
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'going', null, now() - interval '4 days'),
  ('d0000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'going', null, now() - interval '3 days'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'going', null, now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000006', 'going', null, now() - interval '2 days')
on conflict (event_id, user_id) do nothing;

-- event_registrations: canonical contract (20260903010000).
-- FINDING: there is NO plain unique(event_id, user_id) constraint — the
-- dedupe key is the partial unique index
--   event_registrations_active_user_event_unique
--   on (event_id, user_id) where status in ('registered','waitlisted',
--     'checked_in','no_show')
-- so the ON CONFLICT target repeats that predicate.
insert into public.event_registrations (id, event_id, user_id, status, registered_at, waitlist_position) values
  ('d2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'registered', now() - interval '9 days', null),
  ('d2000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'registered', now() - interval '8 days', null),
  ('d2000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'registered', now() - interval '5 days', null),
  ('d2000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'registered', now() - interval '5 days', null),
  ('d2000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'registered', now() - interval '3 days', null),
  ('d2000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'registered', now() - interval '2 days', null)
on conflict (event_id, user_id) where status in ('registered','waitlisted','checked_in','no_show') do nothing;

-- event_agenda: columns from 20260903010000 (id, event_id, title,
-- description, starts_at, ends_at, duration_minutes, speaker_ids jsonb,
-- sort_order). speaker_ids links rows to the deterministic speaker ids.
insert into public.event_agenda (id, event_id, title, description, starts_at, duration_minutes, sort_order, speaker_ids) values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Doors open + chai', 'Badge pickup and informal networking.', now() + interval '7 days', 15, 0, '[]'::jsonb),
  ('d3000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Founder lightning talks', 'Three founders - 10 minutes each: what broke and what worked.', now() + interval '7 days' + interval '15 minutes', 30, 1, '["d4000000-0000-0000-0000-000000000001","d4000000-0000-0000-0000-000000000002"]'::jsonb),
  ('d3000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Table networking', 'Curated table topics and warm intro rounds.', now() + interval '7 days' + interval '45 minutes', 135, 2, '[]'::jsonb),
  ('d3000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'RSC fundamentals', 'Server/client boundary, streaming, caching.', now() + interval '3 days', 45, 0, '[]'::jsonb),
  ('d3000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'Live refactor Q&A', 'Refactoring a real page to RSC live.', now() + interval '3 days' + interval '45 minutes', 45, 1, '[]'::jsonb)
on conflict (id) do nothing;

-- event_speakers: two speakers for E1.
insert into public.event_speakers (id, event_id, name, role, company, avatar_url, bio, sort_order) values
  ('d4000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Alice Chen', 'Frontend Engineer', 'Connect', 'https://randomuser.me/api/portraits/women/44.jpg', 'Design systems and Next.js at scale. Talks about the cost of abstraction.', 0),
  ('d4000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Bob Okafor', 'Founder', 'CashDeck', 'https://randomuser.me/api/portraits/men/32.jpg', 'From payments engineer to fintech founder in 12 months.', 1)
on conflict (id) do nothing;

-- event_media: one gallery image for E1 (public gallery).
insert into public.event_media (id, event_id, type, url, title, description, mime_type, is_public, allow_download, sort_order) values
  ('d5000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'image', 'https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&w=800', 'Last meetup crowd', 'September edition at WeWork Galaxy.', 'image/jpeg', true, false, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. IDEAS
-- ---------------------------------------------------------------------
-- I1 target owns; I2/I3/I4 owned by Alice, Bob, Carla (published) —
-- the ones the target engaged with via idea_interests below.
insert into public.ideas
  (id, owner_id, title, problem, solution, ask, stage, team_needed, tags,
   visibility, join_enabled, validation_count, image_url, created_at, updated_at)
values
  ('e0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f',
   'Connect - cofounder matching for Indian builders',
   'Skilled people in India rarely meet the right cofounder outside their own circle, and randomness decides most founding teams.',
   'Rule-based, explainable matching with warm intros and built-in chat, tuned to Indian builder availability.',
   'A founding engineer to own the matching engine.',
   'mvp', '{engineer,designer}', '{community,matching,saas}',
   'published', true, 6, 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
   now() - interval '20 days', now() - interval '2 days'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'PaisaSetu - UPI credit rails for gig workers',
   'Gig workers get paid weekly but credit scoring treats them like they have no income at all.',
   'Cash-flow underwriting on top of UPI transaction streams with instant micro-loans.',
   'An ML engineer plus one backend intern to build the risk engine.',
   'prototype', '{engineer,data_ml}', '{fintech,upi,lending}',
   'published', true, 4, 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
   now() - interval '15 days', now() - interval '3 days'),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   'CashDeck - credit-first OS for Indian MSMEs',
   'Small merchants juggle WhatsApp ledgers, POS apps and loan agent visits just to understand their own cash flow.',
   'A single dashboard that reconciles UPI settlements, GST invoices and lender offers.',
   'A founding partner who has sold to retailers for warm distribution.',
   'idea', '{engineer,growth}', '{fintech,msme,saas}',
   'published', false, 3, 'https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=800',
   now() - interval '10 days', now() - interval '4 days'),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003',
   'Dosti - collective savings circles for friend groups',
   'Traditional chit funds work but are opaque and clunky; modern fintech ignores the family-and-friends trust layer.',
   'App-managed savings circles with shared pots, transparent payouts and group reminders.',
   'A mobile engineer who loves money mechanics.',
   'idea', '{engineer,designer}', '{fintech,community,mobile}',
   'published', false, 2, 'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=800',
   now() - interval '8 days', now() - interval '5 days')
on conflict (id) do nothing;

-- idea_interests: target engaged with others' ideas + validation on his own.
-- action uses public.recommendation_action (like/pass/spark), unique
-- (idea_id, user_id) per 20260807000000_ideas.sql.
insert into public.idea_interests (id, idea_id, user_id, action, created_at) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'like', now() - interval '2 days'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'spark', now() - interval '3 days'),
  ('e1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'spark', now() - interval '1 day'),
  ('e1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'like', now() - interval '4 days'),
  ('e1000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'like', now() - interval '2 days'),
  ('e1000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'spark', now() - interval '1 day')
on conflict (idea_id, user_id) do nothing;

-- idea_reactions: emoji reactions, one per (idea, user), emoji 1..8 chars
-- (20260922000000_idea_reactions.sql).
insert into public.idea_reactions (id, idea_id, user_id, emoji, created_at) values
  ('e2000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '🚀', now() - interval '2 days'),
  ('e2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '💡', now() - interval '3 days')
on conflict (idea_id, user_id) do nothing;

-- idea_revisions: two snapshots of I1 by the owner (editor = target).
-- unique (idea_id, revision_number) per 20260921030000_idea_revisions.sql.
insert into public.idea_revisions
  (id, idea_id, revision_number, editor_id, title, problem, solution, ask,
   stage, team_needed, tags, visibility, join_enabled, created_at)
values
  ('e3000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'b16b5b49-e640-4dbb-ab17-77bb3064d65f',
   'Connect - cofounder matching for Indian builders',
   'Skilled people in India rarely meet the right cofounder outside their own circle, and randomness decides most founding teams.',
   'Rule-based, explainable matching with warm intros and built-in chat.',
   'Looking for early feedback on the matching model.',
   'idea', '{engineer,designer}', '{community,matching,saas}', 'published', false,
   now() - interval '20 days'),
  ('e3000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'b16b5b49-e640-4dbb-ab17-77bb3064d65f',
   'Connect - cofounder matching for Indian builders',
   'Skilled people in India rarely meet the right cofounder outside their own circle, and randomness decides most founding teams.',
   'Rule-based, explainable matching with warm intros and built-in chat, tuned to Indian builder availability.',
   'A founding engineer to own the matching engine.',
   'mvp', '{engineer,designer}', '{community,matching,saas}', 'published', true,
   now() - interval '2 days')
on conflict (id) do nothing;

-- team_memberships: Alice joined target's I1; target advises Alice's I2.
-- unique (idea_id, user_id) per 20260807000000_ideas.sql.
insert into public.team_memberships (id, idea_id, user_id, role, created_at) values
  ('e4000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Founding Engineer', now() - interval '9 days'),
  ('e4000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Advisor', now() - interval '7 days')
on conflict (idea_id, user_id) do nothing;

-- join_requests: Kate pending on I1 (join_enabled), Emma pre-approved.
-- unique (idea_id, user_id), default status 'pending'.
insert into public.join_requests (id, idea_id, user_id, status, message, created_at, updated_at) values
  ('e5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'pending',
   'Love the vision. I have shipped 4 consumer apps and can own the mobile side.', now() - interval '1 day', now() - interval '1 day'),
  ('e5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'approved',
   'Backend engineer, ex-payments unicorn. Happy to build the matching engine.', now() - interval '12 days', now() - interval '10 days')
on conflict (idea_id, user_id) do nothing;

-- EOF