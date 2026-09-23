-- HOST-DB-02 — swipe score must be server-derived, not caller-supplied.
--
-- The discover pipeline's compatibility score is computed server-side by
-- src/services/matching/engine.ts but was relayed through the client to
-- perform_swipe. A client could assign an arbitrary durable score to
-- recommendations/matches. Range validation (0-100) alone is not
-- authenticity validation.
--
-- Design: a new server-owned, server-written `recommendation_scores` table
-- records the score the discover pipeline actually computed. The RPC derives
-- the score from this table for (auth.uid(), p_candidate_id) instead of
-- trusting the caller. The table is readable only inside the SECURITY
-- DEFINER RPC (service_role); no grants to anon/authenticated, RLS on with no
-- policies.

create table if not exists public.recommendation_scores (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  score        smallint not null check (score between 0 and 100),
  computed_at  timestamptz not null default now(),
  primary key (user_id, candidate_id),
  constraint recommendation_scores_no_self check (user_id <> candidate_id)
);

alter table public.recommendation_scores enable row level security;

-- No grants to anon/authenticated: this is service-role / SECURITY DEFINER
-- write + read state only. There are deliberately no RLS policies, so even a
-- bypass attempt through an authenticated client is rejected by RLS.
revoke all on public.recommendation_scores from anon;
revoke all on public.recommendation_scores from authenticated;
grant all on public.recommendation_scores to service_role;

-- Keep the single 3-arg perform_swipe signature (HOST-DB-01) with p_score
-- default null. p_score is now DEPRECATED and IGNORED: the score is derived
-- from recommendation_scores server-side. The stale-candidate revalidation
-- body from 20260904170000 is preserved intact.
create or replace function public.perform_swipe(
  p_candidate_id uuid,
  p_action       public.recommendation_action,
  p_score        smallint default null
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
  v_score       smallint;
  v_match_created boolean := false;
  v_eligible    boolean;
begin
  -- p_score is deprecated and ignored (HOST-DB-02): the durability of the
  -- score state is server-owned via public.recommendation_scores. The caller
  -- may still pass the legacy 3-arg shape for HOST-DB-01 signature
  -- compatibility, but its value is never trusted or persisted here.

  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_candidate_id is null or v_user_id = p_candidate_id then
    raise exception 'invalid_candidate';
  end if;

  -- Stale-candidate revalidation: the feed that produced this candidate may
  -- be stale. At mutation time the candidate must still (a) exist with a
  -- discoverable profile, and (b) not be blocked in either direction.
  select exists (
    select 1
    from public.profiles p
    where p.id = p_candidate_id
      and p.visibility in ('public', 'recruiting')
  )
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_user_id and b.blocked_id = p_candidate_id)
       or (b.blocker_id = p_candidate_id and b.blocked_id = v_user_id)
  )
  into v_eligible;

  if not v_eligible then
    raise exception 'candidate_unavailable';
  end if;

  -- Derive the score from server-owned recommendation_scores state for
  -- (auth.uid(), p_candidate_id). If the discover pipeline already computed
  -- a score, use it; otherwise fall back to 0 (the historic "never scored"
  -- default for legacy recommendation rows).
  select rs.score
  into v_score
  from public.recommendation_scores rs
  where rs.user_id = v_user_id and rs.candidate_id = p_candidate_id;

  if v_score is null then
    v_score := 0;
  end if;

  -- Record (or update) the acting user's outcome. The derived score is
  -- persisted on the recommendation row (never overwriting an existing
  -- non-null, non-zero score).
  insert into public.recommendations (user_id, candidate_id, action, score)
  values (v_user_id, p_candidate_id, p_action, v_score)
  on conflict (user_id, candidate_id)
  do update
    set action     = excluded.action,
        score      = case
                       when public.recommendations.score is null
                         or public.recommendations.score = 0
                       then excluded.score
                       else public.recommendations.score
                     end,
        created_at = now()
  returning score into v_score;

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
  values (v_user1, v_user2, 'pending', v_score)
  returning id into v_match_id;

  insert into public.match_timeline (match_id, event_type, meta)
  values (
    v_match_id,
    'match_created',
    jsonb_build_object(
      'triggered_by', v_user_id,
      'score', v_score
    )
  );

  v_match_created := true;

  return jsonb_build_object('match_created', v_match_created, 'match_id', v_match_id);
end;
$$;

-- Explicit privilege surface for the exact single remaining signature
-- (HOST-DB-01). Revoke from public/anon, grant only to authenticated.
revoke execute on function public.perform_swipe(uuid, public.recommendation_action, smallint) from public;
revoke execute on function public.perform_swipe(uuid, public.recommendation_action, smallint) from anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action, smallint) to authenticated;
