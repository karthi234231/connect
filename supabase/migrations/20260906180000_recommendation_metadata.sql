-- Audit findings #60/#61: persist the real compatibility score.
--
-- #60: performSwipe stored score 0 — the engine's computed score was discarded.
-- #61: match rows were created with score NULL.
--
-- Design (server-validated): the swipe action passes the score the discover
-- pipeline computed for this candidate; the RPC validates the range (0–100),
-- persists it on the recommendation row (never overwriting an existing
-- non-null score), and copies it into the created match instead of NULL.

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
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_candidate_id is null or v_user_id = p_candidate_id then
    raise exception 'invalid_candidate';
  end if;

  -- Validate the computed score: only accept a well-formed 0–100 integer.
  -- (Client supplies the server-computed value; range validation here keeps a
  -- tampered payload from writing garbage into analytics/match data.)
  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'invalid_score';
  end if;

  -- Record (or update) the acting user's outcome. On a fresh row we persist the
  -- computed score; on an existing row we keep the already-persisted score
  -- (never overwrite a real score with NULL/0 on a re-swipe).
  insert into public.recommendations (user_id, candidate_id, action, score)
  values (v_user_id, p_candidate_id, p_action, coalesce(p_score, 0))
  on conflict (user_id, candidate_id)
  do update
    set action     = excluded.action,
        -- A stored 0 means "never scored" (legacy rows), so a freshly computed
        -- score wins over it; a real non-zero score is never overwritten.
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

  -- #61: the match carries the real compatibility score, not NULL.
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

revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action) to authenticated;