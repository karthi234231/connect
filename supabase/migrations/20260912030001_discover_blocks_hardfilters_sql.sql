-- =============================================================
-- SESSION 15 — DISCOVER QUERY / ELIGIBILITY PIPELINE
-- SQL-ORDER IMPLEMENTATION: HARD FILTERS AT THE QUERY BOUNDARY +
-- POOL/PROBE INDEX SUPPORT.
--
-- The Discover candidate pool (`getDiscoverBatch`, candidates.service.ts)
-- enforces eligibility in SQL order, never `select first 100 → filter in JS`:
--
--   1. visibility            → public_profiles view
--   2. suspension/deletion   → public_profiles view (suspended_at IS NULL)
--   3. browse-ready          → public_profiles view (full_name/role/bio)
--   4. self exclusion        → pool query  .neq("id", userId)         (WHERE)
--   5. previous interactions → pool query  .not("id","in", dismissed) (WHERE,
--                            plus a JS re-application that closes the
--                            read→query race — DB boundary stays primary)
--   6. hard filters          → pool query  WHERE conditions built by
--                            matching.filtersToQueryConditions BEFORE any
--                            cap (lossless JS↔SQL mirror; `skill` has no
--                            lossless PostgREST operator and stays in the
--                            JS net, still pre-cap)
--   7. blocks (directional)  → safety.filterBlockedCandidates (JS, both
--                            block directions) BEFORE the cap
--   8. bounded pool          → .slice(0, DISCOVER_POOL_CAP) applied to the
--                            POST-block, POST-hard-filter list ONLY (the
--                            query is uncapped so a blocked/mismatched row
--                            can never consume a cap slot)
--   9. ranking               → matching.getTopCandidates (last)
--
-- Hard-filter WHERE mapping (each === the `matchesHardFilters` comparison):
--   role            → role                  = <role>
--   workStyle       → work_style            = <workStyle>
--   commitmentLevel → commitment_level      = <commitmentLevel>
--   region          → timezone LIKE '<Region>/%'
--   activeWithinDays→ last_active_at >= <now - N days ISO>
--   availabilityDay → availability->days @> '["<day>"]'
--
-- Why indexes: the pool query is no longer DB-capped (the bounded-pool cap
-- moved AFTER blocks + hard filters), so the view scan and the directional
-- block probe need cheap access paths. Both indexes are additive + guarded.
-- =============================================================

-- Pool scan: serve the view's browse-eligible filter (visibility public or
-- recruiting + not suspended + minimum identity present) so the uncapped
-- discover pool does not scan every profile row.
create index if not exists profiles_discover_browse_ready_idx
  on public.profiles (visibility)
  where suspended_at is null
    and full_name is not null
    and char_length(trim(full_name)) > 0
    and role is not null
    and bio is not null
    and char_length(trim(bio)) > 0;

-- Reverse-direction block probe: `filterBlockedCandidates` (and the discover
-- safety seam generally) resolves "who blocked this viewer" by
-- `blocks.blocked_id = :viewer`, which the PK (blocker_id, blocked_id) alone
-- does not index.
create index if not exists blocks_viewed_id_idx
  on public.blocks (blocked_id);