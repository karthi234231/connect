-- S02 TODO-B unit 9 probe: stale-candidate revalidation in perform_swipe.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp._sw2(uid uuid, cid uuid, act text) returns jsonb
language plpgsql as $$
declare v text;
begin
  select json_build_object('sub', uid)::text into v;
  perform set_config('request.jwt.claims', v, true);
  return public.perform_swipe(cid, act::public.recommendation_action);
end $$;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as u1,
  (select id from auth.users order by id limit 1 offset 1) as u2,
  (select id from auth.users order by id limit 1 offset 2) as u3,
  (select id from auth.users order by id limit 1 offset 3) as u4;

insert into public.profiles (id, full_name, role, visibility)
values
  ((select u2 from _u), 'P Two', 'founder', 'public'),
  ((select u3 from _u), 'P Three', 'founder', 'private'),
  ((select u4 from _u), 'P Four', 'founder', 'public')
on conflict (id) do update set visibility = excluded.visibility;

delete from public.blocks where blocker_id = (select u2 from _u) and blocked_id = (select u1 from _u);
delete from public.matches where user1_id in (select u1 from _u) or user2_id in (select u1 from _u);
delete from public.recommendations where user_id in (select u1 from _u) or user_id in (select u2 from _u);

\echo '=== 1. eligible candidate (public, no blocks) -> swipe ok ==='
select pg_temp._sw2((select u1 from _u), (select u2 from _u), 'like')->>'match_created' as mc;

\echo '=== 2. private-profile candidate -> candidate_unavailable ==='
do $$
begin
  perform pg_temp._sw2((select u1 from _u), (select u3 from _u), 'like');
  raise exception 'PROBE-FAIL: private candidate accepted';
exception when others then
  if sqlerrm = 'candidate_unavailable' then
    raise notice 'OK: private candidate rejected';
  else
    raise;
  end if;
end $$;

\echo '=== 3. candidate who blocked u1 -> candidate_unavailable ==='
insert into public.blocks (blocker_id, blocked_id) values ((select u2 from _u), (select u1 from _u));
do $$
begin
  perform pg_temp._sw2((select u1 from _u), (select u2 from _u), 'spark');
  raise exception 'PROBE-FAIL: blocking candidate accepted';
exception when others then
  if sqlerrm = 'candidate_unavailable' then
    raise notice 'OK: blocked candidate rejected';
  else
    raise;
  end if;
end $$;
delete from public.blocks where blocker_id = (select u2 from _u) and blocked_id = (select u1 from _u);

\echo '=== 4. block removed -> eligible again; mutual likes -> match created ==='
insert into public.recommendations (user_id, candidate_id, action, score)
values ((select u2 from _u), (select u1 from _u), 'like', 0)
on conflict (user_id, candidate_id) do update set action = excluded.action;
select pg_temp._sw2((select u1 from _u), (select u2 from _u), 'like')->>'match_created' as mc;

\echo '=== 5. non-validation action (pass) still recorded, no match ==='
select pg_temp._sw2((select u1 from _u), (select u4 from _u), 'pass')->>'match_created' as mc;

rollback;
