-- S52 — RPC contract cleanup: collapse perform_swipe to exactly one 2-arg
-- signature (p_candidate_id, p_action). The deprecated p_score param
-- (HOST-DB-02 ignored it; the score derives server-side from
-- recommendation_scores) is removed so no caller can pass it and no stale
-- overload remains. Body is otherwise identical to
-- 20260908060000_swipe_score_server_derived.sql.
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
  v_score       smallint;
  v_match_created boolean := false;
  v_eligible    boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_candidate_id is null or v_user_id = p_candidate_id then
    raise exception 'invalid_candidate';
  end if;

  -- Stale-candidate revalidation (20260904170000): blocked either direction
  -- or no longer discoverable → reject.
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_user_id and b.blocked_id = p_candidate_id)
       or (b.blocker_id = p_candidate_id and b.blocked_id = v_user_id)
  ) into v_eligible;
  if v_eligible then
    raise exception 'candidate_not_eligible';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = p_candidate_id
      and p.visibility in ('public', 'recruiting')
      and p.suspended_at is null
  ) into v_eligible;
  if not v_eligible then
    raise exception 'candidate_not_eligible';
  end if;

  -- Server-derived score (HOST-DB-02): from recommendation_scores for
  -- (auth.uid(), p_candidate_id); fall back to 0 when absent.
  select rs.score into v_score
  from public.recommendation_scores rs
  where rs.user_id = v_user_id and rs.candidate_id = p_candidate_id;
  if v_score is null then
    v_score := 0;
  end if;

  -- Record (or update) the acting user's outcome, preserving a real score.
  insert into public.recommendations (user_id, candidate_id, action, score)
  values (v_user_id, p_candidate_id, p_action, v_score)
  on conflict (user_id, candidate_id)
  do update
    set action = excluded.action,
        score  = case
                   when public.recommendations.score is null
                     or public.recommendations.score = 0
                   then excluded.score
                   else public.recommendations.score
                 end;

  if p_action not in ('like', 'spark') then
    return jsonb_build_object('match_created', false, 'match_id', null);
  end if;

  -- Reciprocal like/spark?
  select case p_action when 'like' then 'like'::public.recommendation_action else 'spark'::public.recommendation_action end into v_reverse;
  perform 1 from public.recommendations r
  where r.user_id = p_candidate_id
    and r.candidate_id = v_user_id
    and r.action in ('like', 'spark');
  if not found then
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

-- Drop the obsolete 3-arg overload so exactly one signature is callable.
drop function if exists public.perform_swipe(uuid, public.recommendation_action, smallint);

-- Explicit privilege surface for the single remaining 2-arg signature.
revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from public;
revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action) to authenticated;
