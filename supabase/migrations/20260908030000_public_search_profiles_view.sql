-- =============================================================
-- HOST-AUTH-04 / HOST-PRIV-02 — canonical public-search read model.
--
-- Previously `searchProfiles` read the raw `profiles` table through the
-- service-role admin client (RLS bypass) and stuffed every eligibility
-- predicate into TS filters. That made the DB boundary enforce nothing and
-- left the eligibility predicate scattered/implicit.
--
-- This view centralizes the "publicly discoverable profile" predicate at
-- the database boundary (the single source of truth for PRIV-02):
--   * visibility in ('public','recruiting')
--   * onboarding_status = 'completed'
--   * suspended_at IS NULL
-- It exposes only browse-safe columns (mirror of `public_profiles`). Search
-- and any future discover surface read from here via the RLS-respecting
-- server client instead of the admin client.
--
-- Note: NOT security_invoker — anon has no column grants on
-- onboarding_status/suspended_at, so the view runs as owner (definer style,
-- same as the existing `public_profiles` view), and we GRANT select on the
-- view itself to anon + authenticated.
-- =============================================================

create or replace view public_search_profiles as
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
  and onboarding_status = 'completed'
  and suspended_at is null;

grant select on public_search_profiles to anon, authenticated;
