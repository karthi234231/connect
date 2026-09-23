-- Audit #63/#64/#65/#66: real engagement ranking + keyset pagination for
-- event discovery.
--
-- #63 "popular" fell back to created_at (recency), not engagement.
-- #64 "relevance" was date-ordering wearing a label.
-- #65 lists used OFFSET pagination (O(offset) scans).
-- #66 list endpoints requested count:"exact" for a hasMore flag.
--
-- This view is the real-signal index the repository ranks over:
--   registration_count — actual registrations (the only real engagement
--     signal in the schema today; no views/saves/shares are tracked).
--   popularity_score   = registration_count * decay(days since last update),
--                        decay = 1 / (1 + days) per the audit formula.
--   relevance_score    = popularity_score + recency-proximity boost for
--                        imminent events (engagement weighted by urgency).
--
-- security_invoker keeps events RLS enforced for every viewer.
create or replace view public.event_discovery_index
with (security_invoker = true) as
select
  e.*,
  coalesce(rc.cnt, 0)::float8 as registration_count,
  coalesce(rc.cnt, 0)::float8
    / (1 + greatest(
          0,
          extract(epoch from (now() - coalesce(e.updated_at, e.created_at)))
            / 86400.0
        )) as popularity_score,
  coalesce(rc.cnt, 0)::float8
    / (1 + greatest(
          0,
          extract(epoch from (now() - coalesce(e.updated_at, e.created_at)))
            / 86400.0
        ))
    + 3.0::float8 / (1 + greatest(
          0,
          extract(epoch from (coalesce(e.starts_at, now()) - now())) / 3600.0
        )) as relevance_score
from public.events e
left join (
  select event_id, count(*)::int as cnt
  from public.event_registrations
  where status <> 'cancelled'
  group by event_id
) rc on rc.event_id = e.id;

grant select on public.event_discovery_index to anon, authenticated;