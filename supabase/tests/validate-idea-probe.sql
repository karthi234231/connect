-- S02 TODO-B unit 6 probe: validate_idea atomic RPC.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp._as(uid uuid) returns void language plpgsql as $$
declare v text;
begin
  select json_build_object('sub', uid)::text into v;
  perform set_config('request.jwt.claims', v, true);
end $$;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as owner_id,
  (select id from auth.users order by id limit 1 offset 1) as u1,
  (select id from auth.users order by id limit 1 offset 2) as u2;

insert into public.ideas (id, owner_id, title, problem, solution, ask, stage, team_needed, tags, visibility, join_enabled, validation_count)
values ('00000000-0000-0000-0000-0000a0500050', (select owner_id from _u), 'My title', 'a long problem', 'a long solution', 'ask me', 'idea', '{}', '{}', 'published', true, 0);

\echo '=== 1. u1 likes -> validation_count 1 ==='
select pg_temp._as((select u1 from _u));
set local role postgres;
select (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'like')->>'validation_count')::int as vc,
       (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'like') ->>'interest_count')::int as ic;

\echo '=== 2. u1 re-like -> count unchanged (no double count) ==='
select (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'like') ->>'validation_count')::int as vc;

\echo '=== 3. u1 switches to pass -> count unchanged (existing semantics) ==='
select (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'pass') ->>'validation_count')::int as vc;

\echo '=== 4. u2 likes -> count 2, interest_count 1 ==='
select pg_temp._as((select u2 from _u));
select (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'spark') ->>'validation_count')::int as vc,
       (public.validate_idea('00000000-0000-0000-0000-0000a0500050', 'spark') ->>'interest_count')::int as ic;

\echo '=== 5. unknown idea -> IDEA_NOT_FOUND ==='
select pg_temp._as((select u2 from _u));
do $$
begin
  perform public.validate_idea('00000000-0000-0000-0000-0000a0500051', 'like');
  raise exception 'PROBE-FAIL: missing idea did not raise';
exception when others then
  raise notice 'OK: got expected error %', sqlerrm;
end $$;

\echo '=== 6. persisted state: validation_count=2, interests correct ==='
select validation_count from public.ideas where id='00000000-0000-0000-0000-0000a0500050';
select user_id = (select u1 from _u) as u1_pass, action from public.idea_interests where idea_id='00000000-0000-0000-0000-0000a0500050' order by user_id;

rollback;
