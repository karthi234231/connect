-- HOST-DB-04 fix: GDPR chat-attachment path contract incompatible with cleanup.
--
-- Root cause: bestEffortStorageCleanup calls storage.list(userId, ...) on the
-- match-attachments bucket, but the path contract is
-- match-attachments/{matchId}/{uuid}.{ext} — userId ≠ matchId, so no objects
-- are found.
--
-- Fix: query the matches table (before it is wiped) to discover the user's
-- match IDs, then list and remove objects under each match folder.
--
-- Also: HOST-DB-01 partial — explicitly grant/revoke the 3-arg perform_swipe
-- overload. The 2-arg overload already has explicit grants; the 3-arg overload
-- (created via create-or-replace with a different arg list) had no explicit
-- privilege management.

-- ─── HOST-DB-01: grant 3-arg perform_swipe ────────────────────────────
revoke execute on function public.perform_swipe(uuid, public.recommendation_action, smallint) from public, anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action, smallint) to authenticated;
