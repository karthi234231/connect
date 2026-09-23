-- S02-TODO-B: atomic swipe → match.
--
-- Fixes three defects in the JS-side swipe flow:
--   1. recommendations had NO unique index on (user_id, candidate_id), so the
--      client upsert(onConflict: "user_id,candidate_id") was rejected by
--      Postgres ("no unique constraint matching ON CONFLICT") — every swipe
--      failed once a prior row existed.
--   2. matches INSERT policy only allowed user1_id = auth.uid(), but ids are
--      canonically ordered — the second swiper is user2 when their uuid sorts
--      higher, so mutual matches failed depending on uuid order.
--   3. match_timeline had no INSERT policy — timeline writes were always
--      denied by RLS and only surfaced as a warn log.
--
-- The RPC runs as SECURITY INVOKER (RLS applies) inside one function = one
-- transaction, making swipe-record + reciprocal-check + match-create + timeline
-- atomic. Client then does analytics/logging outside the transaction.

-- 1a. Dedupe existing recommendations (keep newest per pair).
delete from public.recommendations r
using public.recommendations newer
where r.user_id = newer.user_id
  and r.candidate_id = newer.candidate_id
  and r.created_at < newer.created_at;

delete from public.recommendations r
using public.recommendations same_time
where r.user_id = same_time.user_id
  and r.candidate_id = same_time.candidate_id
  and r.created_at = same_time.created_at
  and r.id > same_time.id;

-- 1b. Enforce one outcome per (user, candidate) pair.
alter table public.recommendations
  drop constraint if exists recommendations_user_candidate_key;
alter table public.recommendations
  add constraint recommendations_user_candidate_key
  unique (user_id, candidate_id);

-- ON CONFLICT DO UPDATE runs the UPDATE policy (USING) against the existing
-- row — without this, re-swiping the same candidate fails RLS.
drop policy if exists "Users can update their own recommendations" on public.recommendations;
create policy "Users can update their own recommendations"
  on public.recommendations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Either participant may create the canonical match row.
drop policy if exists "Users can create matches as user1" on public.matches;
drop policy if exists "Participants can create their matches" on public.matches;
create policy "Participants can create their matches"
  on public.matches for insert to authenticated
  with check (
    (user1_id = auth.uid() or user2_id = auth.uid())
    and user1_id < user2_id
  );

-- 3. Timeline events are written by participants when a match advances.
drop policy if exists "Participants can write their match timeline" on public.match_timeline;
create policy "Participants can write their match timeline"
  on public.match_timeline for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

-- 4. Atomic swipe RPC.
--
-- SECURITY DEFINER is required: the reciprocal check must read the OTHER
-- user's recommendation row, which the "read own recommendations" RLS policy
-- (correctly) hides from the caller — under INVOKER the check always saw
-- nothing and mutual matches could never form. Safety: auth.uid() is captured
-- and validated, self-swipes are rejected, search_path is pinned, and every
-- write is still scoped to the calling user's own ids.
create or replace function public.perform_swipe(
  p_candidate_id uuid,
  p_action       public.recommendation_action
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_reverse     public.recommendation_action;
  v_user1       uuid;
  v_user2       uuid;
  v_existing    uuid;
  v_match_id    uuid;
  v_match_created boolean := false;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_candidate_id is null or v_user_id = p_candidate_id then
    raise exception 'invalid_candidate';
  end if;

  -- Record (or update) the acting user's outcome.
  insert into public.recommendations (user_id, candidate_id, action, score)
  values (v_user_id, p_candidate_id, p_action, 0)
  on conflict (user_id, candidate_id)
  do update set action = excluded.action, created_at = now();

  if p_action not in ('like', 'spark') then
    return jsonb_build_object('match_created', false, 'match_id', null);
  end if;

  -- Reciprocal outcome?
  select action into v_reverse
  from public.recommendations
  where user_id = p_candidate_id and candidate_id = v_user_id;

  if v_reverse is null or v_reverse not in ('like', 'spark') then
    return jsonb_build_object('match_created', false, 'match_id', null);
  end if;

  -- Canonical ordering, then idempotent match creation.
  v_user1 := least(v_user_id, p_candidate_id);
  v_user2 := greatest(v_user_id, p_candidate_id);

  select id into v_existing
  from public.matches
  where user1_id = v_user1 and user2_id = v_user2;

  if v_existing is not null then
    return jsonb_build_object('match_created', false, 'match_id', v_existing);
  end if;

  insert into public.matches (user1_id, user2_id, status, score)
  values (v_user1, v_user2, 'pending', null)
  returning id into v_match_id;

  insert into public.match_timeline (match_id, event_type, meta)
  values (
    v_match_id,
    'match_created',
    jsonb_build_object('triggered_by', v_user_id)
  );

  v_match_created := true;

  return jsonb_build_object('match_created', v_match_created, 'match_id', v_match_id);
end;
$$;

revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action) to authenticated;