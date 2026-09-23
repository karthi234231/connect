-- S02-TODO-B unit 2: DB-enforced legal match status transitions.
--
-- The service layer now does conditional updates (expected state in WHERE),
-- but a last line of defense at the DB boundary makes the state machine
-- illegal even for raw SQL / future callers:
--   pending  -> active | declined   (the only legal exits)
--   active   -> declined            (explicit un-match)
--   declined -> (terminal, no moves)
--   anything -> same-status no-op is allowed (idempotent writes)
create or replace function public.enforce_match_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new; -- idempotent write
  end if;

  if old.status = 'pending' and new.status in ('active', 'declined') then
    return new;
  end if;

  if old.status = 'active' and new.status = 'declined' then
    return new;
  end if;

  raise exception
    'illegal match status transition % -> %', old.status, new.status
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists matches_status_transition_guard on public.matches;
create trigger matches_status_transition_guard
  before update of status on public.matches
  for each row
  execute function public.enforce_match_status_transition();