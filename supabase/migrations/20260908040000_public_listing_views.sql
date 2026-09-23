-- =============================================================
-- HOST-PRIV-02 — canonical public listing read models (events/ideas).
--
-- Mirrors public_search_profiles: centralizes the "publicly discoverable
-- entity" predicate for events and ideas at the DB boundary so search and
-- guest browse share one SQL source of truth instead of duplicated TS
-- filters:
--   * events:  visibility = 'public' AND status = 'published'
--   * ideas:   visibility = 'published'
--
-- Exposes only browse-safe columns (no organizer/owner identity rows, no
-- attendee data). Runs as owner (definer style) and is granted SELECT to
-- anon + authenticated — same pattern as public_profiles/public_search_profiles.
-- =============================================================

create or replace view public_events as
select
  id,
  title,
  description,
  type,
  format,
  location_or_link,
  starts_at,
  duration_minutes,
  capacity,
  tags,
  recurrence,
  cover_image,
  timezone,
  venue,
  price,
  currency,
  category,
  created_at,
  updated_at,
  published_at,
  status,
  visibility
from events
where visibility = 'public'
  and status = 'published';

grant select on public_events to anon, authenticated;

create or replace view public_ideas as
select
  id,
  title,
  problem,
  solution,
  ask,
  stage,
  team_needed,
  tags,
  join_enabled,
  validation_count,
  image_url,
  created_at,
  updated_at,
  visibility
from ideas
where visibility = 'published';

grant select on public_ideas to anon, authenticated;