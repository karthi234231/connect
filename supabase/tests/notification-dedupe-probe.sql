-- S02 TODO-B unit 7 probe: recipient-scoped DB-enforced notification dedupe.
-- Delta-based counts so pre-existing seed rows don't skew assertions.
\set ON_ERROR_STOP on
begin;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as u1,
  (select id from auth.users order by id limit 1 offset 1) as u2;

create temp table _b as
select (select count(*) from public.notifications where user_id=(select u1 from _u)) as u1_rows,
       (select count(*) from public.notifications where user_id=(select u2 from _u)) as u2_rows;

\echo '=== 1. u1 insert key-A ok, duplicate key-A rejected (23505) ==='
insert into public.notifications (user_id, type, title, dedupe_key)
values ((select u1 from _u), 'match_created', 'n1', 'key-A');
do $$
begin
  insert into public.notifications (user_id, type, title, dedupe_key)
  values ((select u1 from _u), 'match_created', 'n1-dup', 'key-A');
  raise exception 'PROBE-FAIL: duplicate dedupe_key accepted';
exception when unique_violation then
  raise notice 'OK: duplicate rejected for same recipient';
end $$;

\echo '=== 2. u2 same key-A accepted (recipient-scoped) ==='
insert into public.notifications (user_id, type, title, dedupe_key)
values ((select u2 from _u), 'match_created', 'n2', 'key-A');

\echo '=== 3. null dedupe_key never conflicts ==='
insert into public.notifications (user_id, type, title, dedupe_key)
values ((select u1 from _u), 'match_created', 'n3', null),
       ((select u1 from _u), 'match_created', 'n4', null);

\echo '=== 4. deltas: u1 +3, u2 +1 ==='
select
  (select count(*) from public.notifications where user_id=(select u1 from _u)) - (select u1_rows from _b) as u1_delta,
  (select count(*) from public.notifications where user_id=(select u2 from _u)) - (select u2_rows from _b) as u2_delta;

rollback;
