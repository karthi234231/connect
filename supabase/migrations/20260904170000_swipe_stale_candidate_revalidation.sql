-- S02 TODO-B unit 9: recommendation stale-candidate revalidation at mutation time.
-- perform_swipe trusted the (possibly stale/cached) recommendation feed: a user
-- could swipe on a candidate who had blocked them, been blocked by them, or
-- whose profile became private/stealth after the feed was generated — and a
-- stale reciprocal like would even create a match. Revalidate eligibility
-- inside the RPC, at write time.

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
  v_eligible    boolean;
begin
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
