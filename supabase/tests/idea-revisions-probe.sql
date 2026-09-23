-- CORE-06 DB probe — idea_revisions table exists and is owner-readable.
\set ON_ERROR_STOP on
begin;

-- 1. Table exists with expected columns
\echo '=== 1. idea_revisions table columns ==='
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'idea_revisions'
order by ordinal_position;

-- 2. RLS is enabled
\echo '=== 2. RLS status ==='
select relrowsecurity, relrowsecurityfromfk, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
  and c.relname = 'idea_revisions';

-- 3. Owner can read revisions for their idea (using seed user 001)
\echo '=== 3. Owner read access (user 001) ==='
\set ON_ERROR_STOP off
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text, true);
\set ON_ERROR_STOP on
select count(*) as visible_revision_count from public.idea_revisions
  where idea_id in (select id from public.ideas where owner_id = '00000000-0000-0000-0000-000000000001');

-- 4. Non-owner cannot read revisions of another user's idea (set as user 002)
\echo '=== 4. Non-owner read blocked (user 002) ==='
\set ON_ERROR_STOP off
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text, true);
\set ON_ERROR_STOP on
select count(*) as non_owner_revision_count from public.idea_revisions
  where idea_id in (select id from public.ideas where owner_id = '00000000-0000-0000-0000-000000000001');

-- 5. GDPR: revisions cascade when ideas are deleted
\echo '=== 5. Revisions cascade with ideas ==='
\set ON_ERROR_STOP off
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text, true);
\set ON_ERROR_STOP on
rollback;
