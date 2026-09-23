-- S02 TODO-B unit 10: match pair-uniqueness + legal-transition DB enforcement.
-- The pair-unique constraint is directional: (A,B) and (B,A) both pass
-- matches_pair_unique, so two rows per pair are possible. Status transitions
-- were app-side only; any RLS-authorized write could set active -> pending etc.
-- Canonicalize existing rows, then enforce user1_id < user2_id and a legal
-- transition state machine in the DB.

-- 1. Canonicalize existing rows (children reference matches.id only).
update public.matches
set user1_id = user2_id, user2_id = user1_id
where user1_id > user2_id;

-- 2. Canonical pair ordering + cross-orientation pair uniqueness.
alter table public.matches
  drop constraint if exists matches_user1_lt_user2;

alter table public.matches
  add constraint matches_user1_lt_user2 check (user1_id < user2_id);

create unique index if not exists matches_pair_any_order_unique
on public.matches (least(user1_id, user2_id), greatest(user1_id, user2_id));

-- 3. Participant immutability: matches are created with a canonical pair and
--    never re-paired. (Status transitions are already DB-enforced by
--    20260904100000_match_status_transitions.sql.)
create or replace function public.matches_participants_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.user1_id is distinct from old.user1_id
    or new.user2_id is distinct from old.user2_id then
    raise exception 'match_participants_immutable'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists matches_transition_guard on public.matches;

create trigger matches_participants_guard
before update on public.matches
for each row
execute function public.matches_participants_immutable();
