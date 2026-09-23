-- E2E seed: matches, match timeline, messages, chat_threads projection, reactions.
--
-- Target user: b16b5b49-e640-4dbb-ab17-77bb3064d65f (jogikarthik123@gmail.com)
-- Other users: 00000000-0000-0000-0000-000000000001 Alice Chen
--              00000000-0000-0000-0000-000000000002 Bob Okafor
--              00000000-0000-0000-0000-000000000003 Carla Mendes
--              00000000-0000-0000-0000-000000000004 David Kim
--              00000000-0000-0000-0000-000000000005 Emma Novak
--              00000000-0000-0000-0000-000000000006 Frank Delgado
--
-- Match ids (deterministic):
--   b0000000-...-001 (alice0001, target)  active    score 88
--   b0000000-...-002 (bob0002, target)    active    score 74
--   b0000000-...-003 (carla0003, target)  pending   score 68
--   b0000000-...-004 (david0004, target)  active    score 82
--   b0000000-...-005 (emma0005, target)   declined  score 55
--   b0000000-...-006 (alice0001, bob0002) active    score 91  (non-target chat)
--
-- All target matches use canonical ordering user1_id = candidate, user2_id = target.
-- Timeline ids  b1000000-...-001..015. Message ids b2000000-...-001..022 (single
-- ascending conversation timeline across all matches). Reaction ids b3000000-...-001..003.

-- ---------------------------------------------------------------------------
-- 1. Idempotent cleanup. Keyed on the USER PAIRS this seed owns (not only our
--    deterministic match ids), so any pre-existing match on the same pair —
--    e.g. the live DB's alice<->bob match 10000000-...-001 — is cleared too.
--    Children first. All seeded pairs are stored as user1_id < user2_id.
-- ---------------------------------------------------------------------------
delete from public.message_reactions
 where message_id in (
   select msg.id
     from public.messages msg
     join public.matches m on m.id = msg.match_id
    where (m.user1_id, m.user2_id) in (
      ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
    )
 );

delete from public.messages
 where match_id in (
   select id from public.matches
    where (user1_id, user2_id) in (
      ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
    )
 );

delete from public.match_timeline
 where match_id in (
   select id from public.matches
    where (user1_id, user2_id) in (
      ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
    )
 );

delete from public.chat_threads
 where match_id in (
   select id from public.matches
    where (user1_id, user2_id) in (
      ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
    )
 );

delete from public.matches
 where (user1_id, user2_id) in (
   ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
   ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
   ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
   ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
   ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
 );

-- ---------------------------------------------------------------------------
-- 2. Matches. user1_id < user2_id per matches_user1_lt_user2 CHECK.
--    Direct INSERT of 'active'/'pending'/'declined' is legal: the status
--    transition guard is BEFORE UPDATE of status only (it never fires on INSERT).
-- ---------------------------------------------------------------------------
insert into public.matches (id, user1_id, user2_id, status, score, created_at, updated_at)
values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'active',   88, now() - interval '87 hours', now() - interval '85 hours'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'active',   74, now() - interval '77 hours', now() - interval '75 hours'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'pending',  68, now() - interval '6 hours',  now() - interval '6 hours'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'active',   82, now() - interval '50 hours', now() - interval '47 hours'),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'declined', 55, now() - interval '120 hours', now() - interval '120 hours'),
  ('b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'active',   91, now() - interval '98 hours', now() - interval '96 hours');

-- ---------------------------------------------------------------------------
-- 3. Match timeline events.
-- ---------------------------------------------------------------------------
insert into public.match_timeline (id, match_id, event_type, meta, created_at)
values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'match_created',  '{"triggered_by": "b16b5b49-e640-4dbb-ab17-77bb3064d65f", "score": 88}', now() - interval '87 hours'),
  ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'match_accepted', '{"triggered_by": "00000000-0000-0000-0000-000000000001", "score": 88}', now() - interval '85 hours'),
  ('b1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'first_reply',    '{"triggered_by": "00000000-0000-0000-0000-000000000001", "score": 88}', now() - interval '84 hours'),
  ('b1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'match_created',  '{"triggered_by": "b16b5b49-e640-4dbb-ab17-77bb3064d65f", "score": 74}', now() - interval '77 hours'),
  ('b1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'match_accepted', '{"triggered_by": "00000000-0000-0000-0000-000000000002", "score": 74}', now() - interval '75 hours'),
  ('b1000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'first_reply',    '{"triggered_by": "00000000-0000-0000-0000-000000000002", "score": 74}', now() - interval '75 hours'),
  ('b1000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000003', 'match_created',  '{"triggered_by": "b16b5b49-e640-4dbb-ab17-77bb3064d65f", "score": 68}', now() - interval '6 hours'),
  ('b1000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000003', 'intro_requested','{"triggered_by": "b16b5b49-e640-4dbb-ab17-77bb3064d65f", "score": 68}', now() - interval '5 hours'),
  ('b1000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000004', 'match_created',  '{"triggered_by": "b16b5b49-e640-4dbb-ab17-77bb3064d65f", "score": 82}', now() - interval '50 hours'),
  ('b1000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000004', 'match_accepted', '{"triggered_by": "00000000-0000-0000-0000-000000000004", "score": 82}', now() - interval '47 hours'),
  ('b1000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000004', 'first_reply',    '{"triggered_by": "00000000-0000-0000-0000-000000000004", "score": 82}', now() - interval '47 hours'),
  ('b1000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000005', 'match_created',  '{"triggered_by": "00000000-0000-0000-0000-000000000005", "score": 55}', now() - interval '120 hours'),
  ('b1000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000006', 'match_created',  '{"triggered_by": "00000000-0000-0000-0000-000000000002", "score": 91}', now() - interval '98 hours'),
  ('b1000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000006', 'match_accepted', '{"triggered_by": "00000000-0000-0000-0000-000000000001", "score": 91}', now() - interval '96 hours'),
  ('b1000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000006', 'first_reply',    '{"triggered_by": "00000000-0000-0000-0000-000000000001", "score": 91}', now() - interval '96 hours');

-- ---------------------------------------------------------------------------
-- 4. Messages. Rows are listed in one global ascending conversation timeline
--    (id b2000000-...-001 is earliest, -022 is latest). read_at = recipient
--    read receipt; null means unread for the recipient.
--
--    Match b00...001 (alice-target): 8 messages, last 2 from alice UNREAD.
--    Match b00...002 (bob-target):   5 messages, all read.
--    Match b00...004 (david-target): 6 messages, last 2 from david UNREAD.
--    Match b00...006 (alice-bob):    3 messages, all read.
-- ---------------------------------------------------------------------------
insert into public.messages (id, match_id, sender_id, content, client_message_id, read_at, created_at)
values
  -- b00...006 alice-bob (non-target chat), 3 messages --------------------------------------------------
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Bob! Future matchmaker to matchmaker — we should collab.', gen_random_uuid(), now() - interval '95 hours', now() - interval '96 hours'),
  ('b2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'Ha, agreed. Our scores match at 91 — the algorithm ships what it promises.', gen_random_uuid(), now() - interval '93 hours', now() - interval '94 hours'),
  ('b2000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Dead. See you at the next demo day!', gen_random_uuid(), now() - interval '91 hours', now() - interval '92 hours'),
  -- b00...001 alice-target, 8 messages (first 6 read, last 2 unread from alice) ------------------------
  ('b2000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Hey! Alice here — your profile came up as an 88% match, great to connect.', gen_random_uuid(), now() - interval '83 hours', now() - interval '84 hours'),
  ('b2000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Hi Alice! Love the match-energy. Nice to meet you too.', gen_random_uuid(), now() - interval '80 hours', now() - interval '81 hours'),
  ('b2000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Thanks! I see you build — what are you currently shipping?', gen_random_uuid(), now() - interval '77 hours', now() - interval '78 hours'),
  -- b00...002 bob-target, 5 messages (all read) --------------------------------------------------------
  ('b2000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Hi! Bob here — frontend engineer. Your design-systems post caught my eye.', gen_random_uuid(), now() - interval '74 hours', now() - interval '75 hours'),
  ('b2000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Hey Bob! Appreciate it — I''m a sucker for good component architecture.', gen_random_uuid(), now() - interval '70 hours', now() - interval '71 hours'),
  ('b2000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Same. Want to take the discover page as a pairing exercise?', gen_random_uuid(), now() - interval '65 hours', now() - interval '66 hours'),
  ('b2000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Yes — I can grab the API contract and draft the types tonight.', gen_random_uuid(), now() - interval '61 hours', now() - interval '62 hours'),
  -- b00...001 continues --------------------------------------------------------------------------------
  ('b2000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'I''ve been heads-down on a payments dashboard for my startup. Huge but fun.', gen_random_uuid(), now() - interval '57 hours', now() - interval '58 hours'),
  ('b2000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Perfect. Sending a PR sketch in the next couple days. Great pairing!', gen_random_uuid(), now() - interval '54 hours', now() - interval '55 hours'),
  ('b2000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Payments is the backbone of every good product. Happy to trade notes sometime.', gen_random_uuid(), now() - interval '50 hours', now() - interval '51 hours'),
  -- b00...004 david-target, 6 messages (first 4 read, last 2 unread from david) ------------------------
  ('b2000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Hey — David Kim. Loved your fintech case study. Open to a quick chat?', gen_random_uuid(), now() - interval '46 hours', now() - interval '47 hours'),
  ('b2000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Hey David! Thanks — that study took forever. Happy to chat, what''s on your mind?', gen_random_uuid(), now() - interval '43 hours', now() - interval '44 hours'),
  ('b2000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'Absolutely — free Thursday afternoon if you want a quick call.', gen_random_uuid(), now() - interval '39 hours', now() - interval '40 hours'),
  ('b2000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'I''m working on UPI rails for gig workers — the affordability angle needs a payments brain.', gen_random_uuid(), now() - interval '35 hours', now() - interval '36 hours'),
  ('b2000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', 'That''s a real problem. Let''s block 30 min this week — I''ll share my notes first.', gen_random_uuid(), now() - interval '31 hours', now() - interval '32 hours'),
  -- b00...004 last two from david: UNREAD -----------------------------------------------------------------
  ('b2000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Amazing — I''ll prep the data room. Thursday 2pm your time good?', gen_random_uuid(), null, now() - interval '8 hours'),
  ('b2000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Also attached the customer interview template if you want to peek early.', gen_random_uuid(), null, now() - interval '3 hours'),
  -- b00...001 last two from alice: UNREAD ------------------------------------------------------------------
  ('b2000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Thursday works! Locking it in — I''ll send a calendar invite.', gen_random_uuid(), null, now() - interval '2 hours'),
  ('b2000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Also — quick thought: we should pair on a demo day soon. Ping me when you''re free!', gen_random_uuid(), null, now() - interval '30 minutes');

-- ---------------------------------------------------------------------------
-- 5. Recompute chat_threads projection from the seed data.
--    The after-insert on_message trigger bumps unread counters even for
--    messages inserted with read_at already set, so recompute deterministically
--    from messages (mirrors the migration backfill).
-- ---------------------------------------------------------------------------
update public.chat_threads t
   set last_message_id       = s.id,
       last_message_at       = s.created_at,
       last_message_content  = s.content,
       last_message_sender_id = s.sender_id,
       updated_at            = now()
  from (
    select distinct on (match_id)
      match_id, id, created_at, content, sender_id
    from public.messages
    where match_id in (
      'b0000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000002',
      'b0000000-0000-0000-0000-000000000003',
      'b0000000-0000-0000-0000-000000000004',
      'b0000000-0000-0000-0000-000000000005',
      'b0000000-0000-0000-0000-000000000006'
    )
    order by match_id, created_at desc, id desc
  ) s
 where t.match_id = s.match_id;

update public.chat_threads t
   set unread_user1 = coalesce(s.u1, 0),
       unread_user2 = coalesce(s.u2, 0)
  from (
    select m.id as match_id,
           count(msg.id) filter (where msg.sender_id <> m.user1_id and msg.read_at is null) as u1,
           count(msg.id) filter (where msg.sender_id <> m.user2_id and msg.read_at is null) as u2
      from public.matches m
      left join public.messages msg on msg.match_id = m.id
     where (m.user1_id, m.user2_id) in (
       ('00000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
       ('00000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
       ('00000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
       ('00000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
       ('00000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f'),
       ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
     )
     group by m.id, m.user1_id, m.user2_id
  ) s
 where s.match_id = t.match_id;

-- ---------------------------------------------------------------------------
-- 6. Message reactions (target is a participant in every message chosen;
--    candidates react too).
-- ---------------------------------------------------------------------------
insert into public.message_reactions (id, message_id, user_id, emoji, created_at)
values
  ('b3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '🔥', now() - interval '80.5 hours'),
  ('b3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000022', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '❤️', now() - interval '25 minutes'),
  ('b3000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000019', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '👍', now() - interval '7 hours')
on conflict (message_id, user_id) do nothing;

-- EOF