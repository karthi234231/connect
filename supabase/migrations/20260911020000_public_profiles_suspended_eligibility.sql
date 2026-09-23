-- =============================================================
-- #168 — DISCOVER DB HARD ELIGIBILITY: SUSPENDED USERS ARE NOT DISCOVERABLE.
--
-- The `public_profiles` view (defined in 20260805003146_rls.sql) drives the
-- Discover candidate pool but only filtered `visibility in ('public',
-- 'recruiting')`. A suspended user could therefore appear in a Discover batch
-- and consume the ranking budget.
--
-- This recreates the view with the same column list + grants and adds
-- `suspended_at is null`, so the DB boundary (not TypeScript) enforces the
-- eligibility rule — the same canonical predicate `public_search_profiles`
-- already uses. Not security_invoker: anon has no column grant on
-- `suspended_at`, so the view runs owner-definer like the original, and we
-- grant select on the view to anon + authenticated.
-- =============================================================

create or replace view public_profiles as
select
  id,
  full_name,
  avatar_url,
  role,
  bio,
  skills,
  availability,
  timezone,
  looking_for,
  visibility,
  last_active_at,
  commitment_level,
  work_style,
  created_at,
  updated_at
from profiles
where visibility in ('public', 'recruiting')
  and suspended_at is null;

grant select on public_profiles to authenticated, anon;