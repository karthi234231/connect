-- S02-TODO-B unit 3: atomic connection accept → active match.
--
-- Defects fixed in the JS-side flow:
--   1. Non-atomic: request flipped to "accepted" first, then the match insert
--      could fail → accepted pair with no match (invalid domain state).
--   2. Match insert used raw requester/addressee order, which can violate the
--      canonical user1_id < user2_id RLS/check on matches.
--   3. No match_timeline event on acceptance.
--   4. (service file) (supabase as any) casts.
--
-- One SECURITY DEFINER transaction: conditional pending→accepted update by
-- the addressee, canonical idempotent match insert (unique pair constraint),
-- timeline event. auth.uid() captured + validated; search_path pinned.

create or replace function public.respond_connection_request(
  p_request_id uuid,
  p_decision   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_requester  uuid;
  v_addressee  uuid;
  v_updated    boolean;
  v_user1      uuid;
  v_user2      uuid;
  v_existing   uuid;
  v_match_id   uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_decision not in ('accept', 'decline') then
    raise exception 'invalid_decision';
  end if;

  -- Lock the request row; only the addressee may act, only while pending.
  select requester_id, addressee_id
    into v_requester, v_addressee
  from public.connection_requests
  where id = p_request_id
  for update;

  if not found or v_addressee is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_decision = 'decline' then
    update public.connection_requests
    set status = 'declined', responded_at = now()
    where id = p_request_id and status = 'pending';

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'not_pending');
    end if;

    return jsonb_build_object('ok', true, 'status', 'declined', 'match_id', null);
  end if;

  -- accept: conditional pending→accepted
  update public.connection_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id and status = 'pending';

  v_updated := found;

  -- Canonical ordering; idempotent active match creation.
  v_user1 := least(v_requester, v_addressee);
  v_user2 := greatest(v_requester, v_addressee);

  select id into v_existing
  from public.matches
  where user1_id = v_user1 and user2_id = v_user2;

  if v_existing is not null then
    -- Request was left pending after the pair already matched: reconcile.
    if not v_updated then
      update public.connection_requests
      set status = 'accepted', responded_at = now()
      where id = p_request_id and status = 'pending';
    end if;
    return jsonb_build_object('ok', true, 'status', 'accepted', 'match_id', v_existing);
  end if;

  insert into public.matches (user1_id, user2_id, status, score)
  values (v_user1, v_user2, 'active', null)
  returning id into v_match_id;

  insert into public.match_timeline (match_id, event_type, meta)
  values (v_match_id, 'match_accepted', jsonb_build_object('via', 'connection_request'));

  return jsonb_build_object('ok', true, 'status', 'accepted', 'match_id', v_match_id);
end;
$$;

revoke execute on function public.respond_connection_request(uuid, text) from anon;
grant execute on function public.respond_connection_request(uuid, text) to authenticated;