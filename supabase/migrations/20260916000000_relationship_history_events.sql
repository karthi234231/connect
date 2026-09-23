-- 20260916000000_relationship_history_events.sql
-- P0-11 (spec §140.4 / §360.1) — relationship history transitions.
--
-- §140.4 requires a compact event history for important relationship
-- transitions: created → accepted → message started → call scheduled → group
-- joined → contribution → relationship ended.
--
-- The original enum only covered four of those. This migration completes the
-- vocabulary so future writers (scheduling, groups, contributions) persist the
-- same canonical transition names instead of inventing new ones.
--
-- NOTE: no writer exists yet for the four new values — they are added so the
-- contract is frozen before those features land (§360.2 "AI agents must not
-- invent lifecycle transitions independently"). No rows are fabricated.
--
-- `ADD VALUE IF NOT EXISTS` is idempotent and, on PG12+, may run inside a
-- migration transaction provided the new value is not used in the same
-- transaction (it is not).

alter type public.match_timeline_event_type
  add value if not exists 'relationship_ended';

alter type public.match_timeline_event_type
  add value if not exists 'call_scheduled';

alter type public.match_timeline_event_type
  add value if not exists 'group_joined';

alter type public.match_timeline_event_type
  add value if not exists 'contribution';

-- Read path support: history is always fetched for one match ordered by time.
-- The existing match_timeline_match_id_created_at_idx already serves this; no
-- new index is required (avoid redundant write amplification).
