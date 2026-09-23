-- Session: #37 — match accept + timeline entry must be one transaction.
-- The service previously did a conditional UPDATE then a separate timeline
-- INSERT: a failure between them left an accepted match with no timeline
-- event. Mirrors perform_swipe's SECURITY DEFINER pattern.
create or replace function public.sp_accept_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Conditional transition + verification must see the participant row.
  update public.matches
     set status = 'active', updated_at = now()
   where id = p_match_id
     and status = 'pending'
     and (user1_id = v_user or user2_id = v_user);
  if not found then
    raise exception 'match_not_pending';
  end if;

  insert into public.match_timeline (match_id, event_type, meta)
  values (p_match_id, 'match_accepted',
          jsonb_build_object('accepted_by', v_user));
end;
$$;

revoke all on function public.sp_accept_match(uuid) from public, anon;
grant execute on function public.sp_accept_match(uuid) to authenticated;
