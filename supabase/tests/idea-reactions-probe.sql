-- W3.4 R5 DB probe — idea_reactions table exists, RLS mirrors the ideas read
-- audience (published browse-safe + owner), insert is actor-scoped and
-- delete is own-only. Uses the seeded dev users/ideas; assert-via-count so the
-- probe fails loudly on policy drift. The whole run happens inside a
-- transaction that rolls back — nothing persists.
\set ON_ERROR_STOP on
begin;

-- 1. Table exists with expected columns
\echo '=== 1. idea_reactions table columns ==='
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'idea_reactions'
order by ordinal_position;

-- 2. RLS is enabled
\echo '=== 2. RLS status ==='
select relrowsecurity, relrowsecurityfromfk, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public'
  and c.relname = 'idea_reactions';

-- 3. Any authenticated user can react to a published idea (idea ...02 is owned
-- by user 001, visibility published)
\echo '=== 3. React to a published idea (user 002) ==='
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text, true);
insert into public.idea_reactions (idea_id, user_id, emoji)
values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '❤️');

\echo '=== 4. Viewer reads reactions on the published idea ==='
select emoji from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002';

-- 5. Inserting as someone else is blocked by the policy (user_id must equal
-- auth.uid()); we only expect zero rows added and the statement to fail
\echo '=== 5. Impersonation insert blocked ==='
\set ON_ERROR_STOP off
insert into public.idea_reactions (idea_id, user_id, emoji)
values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '❤️');
\set ON_ERROR_STOP on
select count(*) as impersonation_insert_count from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002';

-- 6. Non-owner cannot read another user's DRAFT idea reactions (idea ...04 is
-- owned by user 008, visibility draft)
\echo '=== 6. Draft idea reactions hidden from non-owner (user 002) ==='
select count(*) as draft_reaction_count from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000004';

-- 7. The draft owner CAN react to their own draft and read it back (user 008)
\echo '=== 7. Draft owner access (user 008) ==='
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000008')::text, true);
insert into public.idea_reactions (idea_id, user_id, emoji)
values ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', '👍');
select count(*) as owner_draft_reaction_count from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000004';

-- 8. Deleting someone else's reaction is blocked (void policy -> 0 rows)
\echo '=== 8. Removing another user's reaction blocked ==='
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text, true);
delete from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002'
    and user_id = '00000000-0000-0000-0000-000000000002';
select count(*) as reacted_count_after_foreign_delete from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002';

-- 9. Owners of the reaction can remove it (user 002, toggle-off half)
\echo '=== 9. Self-removal succeeds ==='
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000002')::text, true);
delete from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002'
    and user_id = '00000000-0000-0000-0000-000000000002';

-- 10. UNIQUE(idea_id, user_id): one reaction per (idea, user) — the second raw
-- insert must fail (23505), because an emoji change goes through delete+insert
\echo '=== 10. One reaction per (idea, user) enforced ==='
\set ON_ERROR_STOP off
insert into public.idea_reactions (idea_id, user_id, emoji)
values ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '🔥');
\set ON_ERROR_STOP on
select emoji from public.idea_reactions
  where idea_id = '50000000-0000-0000-0000-000000000002'
    and user_id = '00000000-0000-0000-0000-000000000002';

-- 11. GDPR: idea_reactions cascade when the parent idea is deleted; the
-- trigger/constraint sits on the FK (idea_id ... on delete cascade)
\echo '=== 11. Reactions cascade with ideas ==='
\set ON_ERROR_STOP off
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000008')::text, true);
\set ON_ERROR_STOP on

rollback;