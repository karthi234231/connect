-- Finding #1 (P0): perform_swipe signature drift.
-- The 2-arg overload (uuid, recommendation_action) is legacy: create-or-replace
-- with an added p_score smallint default null produced a second signature
-- instead of replacing the first. The app (match.service.ts) always resolves to
-- the 3-arg overload (explicit grants in 20260908020000). The legacy 2-arg
-- overload bypasses the stale-candidate revalidation logic added in
-- 20260904170000 (which only patched the 3-arg body) and must not remain
-- callable. Drop it so there is exactly one callable signature.
drop function if exists public.perform_swipe(uuid, public.recommendation_action);
