-- =============================================================
-- SESSION 15 — DISCOVER QUERY / ELIGIBILITY PIPELINE
-- SQL-ORDER GATE: "profile browse-ready" (onboarding eligibility).
--
-- The Discover candidate pool must exclude profiles that are not
-- browse-ready (i.e. the owner never provided the minimum identity to
-- meaningfully match). Otherwise a half-complete profile consumes the
-- DISCOVER_POOL_CAP slot and the ranking budget, starving eligible
-- candidates and degrading feed quality.
--
-- The TS browse-ready model (`services/profiles/completeness.ts`) requires
-- BROWSE_FIELDS = fullName + role + bio to be present. This migration
-- recreates `public_profiles` (2nd recreation; base in 20260805003146_rls,
-- suspended-gate in 20260911020000) with that predicate pushed to the DB
-- boundary so it is enforced in SQL order ("browse-ready"), never in a
-- "select first N → filter in JS" pass.
--
-- Full S15 SQL order (each gate owned by one stage):
--   visibility            → WHERE visibility IN ('public','recruiting')
--   suspension/deletion   → WHERE suspended_at IS NULL
--   browse-ready          → full_name/role/bio present  (THIS migration)
--   self exclusion        → .neq("id", userId)                 (service)
--   previous interactions → .not("id","in", dismissed)         (service)
--   blocks (directional)  → safety.filterBlockedCandidates     (service)
--   hard filters          → matching.matchesHardFilters        (service)
--   bounded pool          → .limit(DISCOVER_POOL_CAP)          (service)
--   ranking               → matching.getTopCandidates          (service)
--
-- Keeps the same column list + grants; not security_invoker (anon has no
-- column grants on the source tables), see 20260911020000 rationale.
-- =============================================================

create or replace view public_profiles
as
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
  and suspended_at is null
  -- browse-ready: the owner supplied a real identity (mirrors BROWSE_FIELDS).
  and full_name is not null
  and char_length(trim(full_name)) > 0
  and role is not null
  and bio is not null
  and char_length(trim(bio)) > 0;

grant select on public_profiles to authenticated, anon;