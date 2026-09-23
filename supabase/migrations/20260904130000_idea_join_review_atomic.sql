-- S02-TODO-B unit 4: atomic idea join review → approved + team membership.
--
-- Defects fixed in the JS-side flow (idea.service.ts reviewJoin):
--   1. Non-atomic: join_requests.status flipped first, then the team_memberships
--      upsert could fail and was only logged as a warning → approved join with
--      no membership (invalid domain state).
--   2. No reviewer ownership check inside the mutation: anyone whose RLS permits
--      a row update could approve; the service never verified idea ownership.
--   3. Unconditional status write: an already approved/rejected request could be
--      re-approved (state machine violation, duplicate membership churn).
--   4. (supabase as any) casts.
--
-- One SECURITY DEFINER transaction: locks the join request FOR UPDATE, verifies
-- the caller is the idea owner, conditional pending→approved|rejected,
-- idempotent team_memberships upsert on approve. auth.uid() captured +
-- validated; search_path pinned.

create or replace function public.review_idea_join_request(
  p_join_request_id uuid,
  p_idea_id         uuid,
  p_decision        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_owner_id  uuid;
  v_applicant uuid;
  v_status    join_request_status;
  v_updated   boolean;
  v_idea_id   uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid_decision';
  end if;

  -- Lock the join request; capture its idea owner + idea id.
  select jr.user_id, i.owner_id, jr.idea_id
    into v_applicant, v_owner_id, v_idea_id
  from public.join_requests jr
  join public.ideas i on i.id = jr.idea_id
  where jr.id = p_join_request_id
  for update of jr;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Only the idea owner may review.
  if v_owner_id is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  if p_idea_id is distinct from v_idea_id then
    return jsonb_build_object('ok', false, 'reason', 'idea_mismatch');
  end if;

  v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  -- Conditional pending→target transition (idempotent re-review returns the
  -- existing state instead of duplicating work).
  update public.join_requests
  set status = v_status, updated_at = now()
  where id = p_join_request_id and status = 'pending';

  v_updated := found;

  if not v_updated then
    -- Not pending anymore — report current state, do not re-run side effects.
    select status into v_status from public.join_requests where id = p_join_request_id;
    return jsonb_build_object('ok', true, 'status', v_status, 'membership_created', false);
  end if;

  if p_decision = 'approve' then
    insert into public.team_memberships (idea_id, user_id, role)
    values (v_idea_id, v_applicant, 'member')
    on conflict (idea_id, user_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'membership_created', p_decision = 'approve');
end;
$$;

revoke execute on function public.review_idea_join_request(uuid, uuid, text) from anon;
grant execute on function public.review_idea_join_request(uuid, uuid, text) to authenticated;
