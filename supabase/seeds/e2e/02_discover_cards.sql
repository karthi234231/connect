-- =====================================================================
-- E2E seed: Discover swipe-feed cards for the real test user.
-- Target user: b16b5b49-e640-4dbb-ab17-77bb3064d65f
--               (jogikarthik123@gmail.com, "Karthik Jogi")
--
-- Seeds three pieces of matching state so the Discover feed shows ranked
-- candidates with scores, outcomes, and quota:
--   1. recommendation_scores  - server-owned score state (reads via the
--      2-arg perform_swipe feed). 12 candidates, scores 55-95.
--   2. recommendations        - outcome log (pass/like/spark history).
--   3. swipe_daily_quota      - today (used 3) + yesterday (used 6) so the
--      quota UI shows a non-exhausted state.
--
-- No grants, no auth.users, no DDL. Plain DML only.
-- Idempotent via ON CONFLICT on the natural keys.
-- =====================================================================

-- 1. recommendation_scores (service-role score state) ------------------
-- scores align with the outcome log action below:
--   pass  55-62 | like 65-85 | spark 86-95
insert into public.recommendation_scores (user_id, candidate_id, score, computed_at)
values
  -- spark (strong fits)
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000001', 92, now() - interval '2 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000003', 88, now() - interval '5 hours'),
  -- like (pending, swipeable)
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000004', 82, now() - interval '9 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000002', 78, now() - interval '14 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000009', 75, now() - interval '26 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000006', 71, now() - interval '31 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000b', 69, now() - interval '49 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000007', 67, now() - interval '3 days'),
  -- pass (already swiped away)
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000a', 61, now() - interval '4 days'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000c', 60, now() - interval '4 days' + interval '6 hours'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000005', 58, now() - interval '5 days'),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000008', 55, now() - interval '6 days')
on conflict (user_id, candidate_id)
do update set score = excluded.score, computed_at = excluded.computed_at;

-- 2. recommendations (outcome log) -------------------------------------
-- 4 pass | 6 like | 2 spark — deterministic ids, created_at staggered
-- over the past week, expiry 7 days out.
insert into public.recommendations (id, user_id, candidate_id, score, action, reasons, breakdown, created_at, expires_at)
values
  -- spark
  ('a2000000-0000-0000-0000-000000000001', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000001', 92, 'spark', '["shared_skill:product_management","shared_skill:ai","role_fit:engineer","timezone:Asia/Kolkata"]', '{"skill":28,"intent":22,"role":20,"availability":10,"activity":7,"timezone":5}', now() - interval '2 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000002', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000003', 88, 'spark', '["looking_for:founder","shared_skill:product_management","timezone:Asia/Kolkata"]', '{"skill":24,"intent":24,"role":18,"availability":11,"activity":8,"timezone":3}', now() - interval '5 hours', now() + interval '7 days'),
  -- like
  ('a2000000-0000-0000-0000-000000000003', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000004', 82, 'like', '["shared_skill:backend","shared_skill:ai","intent:open_to_collab"]', '{"skill":26,"intent":18,"role":19,"availability":9,"activity":7,"timezone":3}', now() - interval '9 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000004', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000002', 78, 'like', '["shared_skill:backend","timezone:Asia/Kolkata","activity:recently_active"]', '{"skill":22,"intent":16,"role":17,"availability":10,"activity":9,"timezone":4}', now() - interval '14 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000005', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000009', 75, 'like', '["looking_for:growth","intent:open_to_collab"]', '{"skill":20,"intent":19,"role":14,"availability":9,"activity":8,"timezone":5}', now() - interval '26 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000006', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000006', 71, 'like', '["shared_skill:growth","timezone:Asia/Kolkata"]', '{"skill":21,"intent":15,"role":13,"availability":11,"activity":6,"timezone":5}', now() - interval '31 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000007', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000b', 69, 'like', '["intent:mentorship","role_fit:engineer"]', '{"skill":18,"intent":17,"role":15,"availability":8,"activity":6,"timezone":5}', now() - interval '49 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-000000000008', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000007', 67, 'like', '["shared_skill:product_management","role_fit:designer"]', '{"skill":18,"intent":14,"role":15,"availability":9,"activity":7,"timezone":4}', now() - interval '3 days', now() + interval '7 days'),
  -- pass
  ('a2000000-0000-0000-0000-000000000009', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000a', 61, 'pass', '["availability:weekends_only"]', '{"skill":16,"intent":12,"role":13,"availability":5,"activity":7,"timezone":8}', now() - interval '4 days', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-00000000000a', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-00000000000c', 60, 'pass', '["visibility:stealth","timezone:mismatch"]', '{"skill":15,"intent":11,"role":12,"availability":7,"activity":6,"timezone":9}', now() - interval '4 days' + interval '6 hours', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-00000000000b', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000005', 58, 'pass', '["availability:weekends_only","intent:low_signal"]', '{"skill":14,"intent":10,"role":12,"availability":6,"activity":8,"timezone":8}', now() - interval '5 days', now() + interval '7 days'),
  ('a2000000-0000-0000-0000-00000000000c', 'b16b5b49-e640-4dbb-ab17-77bb3064d65f', '00000000-0000-0000-0000-000000000008', 55, 'pass', '["role_fit:low","availability:weekends_only"]', '{"skill":13,"intent":11,"role":10,"availability":6,"activity":7,"timezone":8}', now() - interval '6 days', now() + interval '7 days')
on conflict (user_id, candidate_id)
do update set
  score = excluded.score,
  action = excluded.action,
  reasons = excluded.reasons,
  breakdown = excluded.breakdown,
  created_at = excluded.created_at,
  expires_at = excluded.expires_at;

-- 3. swipe_daily_quota ------------------------------------------------
-- today used 3, yesterday used 6 — shows quota state without exhausting it.
insert into public.swipe_daily_quota (user_id, quota_day, used_count)
values
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', now()::date,               3),
  ('b16b5b49-e640-4dbb-ab17-77bb3064d65f', (now()::date - interval '1 day')::date, 6)
on conflict (user_id, quota_day)
do update set used_count = excluded.used_count;

-- EOF