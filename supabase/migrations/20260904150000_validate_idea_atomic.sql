-- S02 TODO-B unit 6: idea validation counts concurrency-safe.
-- Replaces read-modify-write (SELECT validation_count -> write +1) which lost
-- updates under concurrency. RPC locks the idea row (FOR UPDATE serializes
-- counters per idea), upserts the interest, increments conditionally in the
-- same transaction, and returns the authoritative counts.

create or replace function public.validate_idea(
  p_idea_id uuid,
  p_action public.recommendation_action
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_count int;
  v_interest_count int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Serialize per-idea counters; also asserts existence.
  select validation_count
  into v_count
  from public.ideas
  where id = p_idea_id
  for update;

  if not found then
    raise exception 'IDEA_NOT_FOUND';
  end if;

  select action
  into v_prev
  from public.idea_interests
  where idea_id = p_idea_id
    and user_id = auth.uid();

  insert into public.idea_interests (idea_id, user_id, action)
  values (p_idea_id, auth.uid(), p_action)
  on conflict (idea_id, user_id)
  do update set action = excluded.action;

  -- Same transition semantics as before: increment only on
  -- non-validation -> validation (never double-counts, never decrements).
  if p_action in ('like', 'spark')
    and coalesce(v_prev, '') not in ('like', 'spark') then
    update public.ideas
    set validation_count = validation_count + 1
    where id = p_idea_id
    returning validation_count into v_count;
  end if;

  select count(*)::int
  into v_interest_count
  from public.idea_interests
  where idea_id = p_idea_id
    and action in ('like', 'spark');

  return json_build_object(
    'validation_count', v_count,
    'interest_count', v_interest_count
  );
end;
$$;

revoke execute on function public.validate_idea(uuid, public.recommendation_action) from anon;
grant execute on function public.validate_idea(uuid, public.recommendation_action) to authenticated;
