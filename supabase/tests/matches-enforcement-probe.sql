-- S02 TODO-B unit 10 probe: matches pair-uniqueness + legal transitions.
\set ON_ERROR_STOP on
begin;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as ua,
  (select id from auth.users order by id limit 1 offset 1) as ub;

delete from public.matches where
  (user1_id, user2_id) in (select (select ua from _u), (select ub from _u)) or (user1_id, user2_id) in (select (select ub from _u), (select ua from _u));

\echo '=== 1. canonical insert (ua, ub) ok ==='
insert into public.matches (user1_id, user2_id, status) values ((select ua from _u), (select ub from _u), 'pending') returning user1_id = (select ua from _u) as canonical;

\echo '=== 2. reversed pair (ub, ua) rejected by canonical check ==='
do $$
begin
  insert into public.matches (user1_id, user2_id, status)
  values ((select ub from _u), (select ua from _u), 'pending');
  raise exception 'PROBE-FAIL: non-canonical pair accepted';
exception when check_violation then
  raise notice 'OK: non-canonical pair rejected';
end $$;

\echo '=== 3. self-match rejected ==='
do $$
begin
  insert into public.matches (user1_id, user2_id, status)
  values ((select ua from _u), (select ua from _u), 'pending');
  raise exception 'PROBE-FAIL: self-match accepted';
exception when check_violation then
  raise notice 'OK: self-match rejected';
end $$;

\echo '=== 4. pending -> active ok ==='
update public.matches set status = 'active'
where user1_id = (select ua from _u) and user2_id = (select ub from _u)
returning status;

\echo '=== 5. active -> pending rejected (illegal transition, unit 2 guard) ==='
do $$
begin
  update public.matches set status = 'pending'
  where user1_id = (select ua from _u) and user2_id = (select ub from _u);
  raise exception 'PROBE-FAIL: illegal transition accepted';
exception when check_violation then
  raise notice 'OK: illegal transition rejected';
end $$;

\echo '=== 6. declined -> active rejected ==='
delete from public.matches where user1_id = (select ua from _u) and user2_id = (select ub from _u);
insert into public.matches (user1_id, user2_id, status) values ((select ua from _u), (select ub from _u), 'declined');
do $$
begin
  update public.matches set status = 'active'
  where user1_id = (select ua from _u) and user2_id = (select ub from _u);
  raise exception 'PROBE-FAIL: declined -> active accepted';
exception when check_violation then
  raise notice 'OK: declined -> active rejected';
end $$;

\echo '=== 7. participant swap rejected ==='
delete from public.matches where user1_id = (select ua from _u) and user2_id = (select ub from _u);
insert into public.matches (user1_id, user2_id, status) values ((select ua from _u), (select ub from _u), 'pending');
do $$
begin
  update public.matches set user1_id = (select ub from _u), user2_id = (select ua from _u)
  where user1_id = (select ua from _u) and user2_id = (select ub from _u);
  raise exception 'PROBE-FAIL: participant swap accepted';
exception when check_violation then
  raise notice 'OK: participant swap rejected';
end $$;

\echo '=== 8. active -> declined (explicit un-match) legal ==='
update public.matches set status = 'active'
where user1_id = (select ua from _u) and user2_id = (select ub from _u);
update public.matches set status = 'declined'
where user1_id = (select ua from _u) and user2_id = (select ub from _u)
returning status;

rollback;
