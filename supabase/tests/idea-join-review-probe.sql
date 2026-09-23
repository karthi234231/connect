-- S02-TODO-B unit 4 probe: review_idea_join_request atomic RPC.
-- All scenarios reference ONE idea; distinct applicants so the
-- (idea_id,user_id) unique constraint is not re-hit within the transaction.
\set ON_ERROR_STOP on
begin;

create temp table _u as
select
  (select id from auth.users order by id limit 1 offset 0) as owner_id,
  (select id from auth.users order by id limit 1 offset 1) as applicant_id,
  (select id from auth.users order by id limit 1 offset 2) as stranger_id,
  (select id from auth.users order by id limit 1 offset 3) as applicant2_id;

-- Single idea (fixed literal uuid), one pending req from applicant & one from applicant2.
insert into public.ideas (id, owner_id, title, problem, solution, ask, stage, team_needed, tags, visibility, join_enabled, validation_count)
values ('00000000-0000-0000-0000-0000a0400040', (select owner_id from _u), 'My title', 'a long problem', 'a long solution', 'ask me', 'idea', '{}', '{}', 'published', true, 0);

insert into public.join_requests (idea_id, user_id, status)
select '00000000-0000-0000-0000-0000a0400040', (select applicant_id from _u), 'pending';
insert into public.join_requests (idea_id, user_id, status)
select '00000000-0000-0000-0000-0000a0400040', (select applicant2_id from _u), 'pending';

create temp table _req_a as select id from public.join_requests where user_id = (select applicant_id from _u) and idea_id = '00000000-0000-0000-0000-0000a0400040';
create temp table _req_b as select id from public.join_requests where user_id = (select applicant2_id from _u) and idea_id = '00000000-0000-0000-0000-0000a0400040';

\echo '=== 1. approve as owner -> membership created ==='
do $$
declare v text;
begin
  select json_build_object('sub', (select owner_id from _u))::text into v;
  perform set_config('request.jwt.claims', v, true);
end $$;
set local role postgres;
select * from public.review_idea_join_request(
  (select id from _req_a), '00000000-0000-0000-0000-0000a0400040', 'approve'
);
select idea_id, user_id, role from public.team_memberships where idea_id = '00000000-0000-0000-0000-0000a0400040';

\echo '=== 2. re-approve (not pending) -> idempotent, membership_created=false ==='
select * from public.review_idea_join_request(
  (select id from _req_a), '00000000-0000-0000-0000-0000a0400040', 'approve'
);

\echo '=== 3. reject (applicant2) as owner -> rejected, no membership ==='
select * from public.review_idea_join_request(
  (select id from _req_b), '00000000-0000-0000-0000-0000a0400040', 'reject'
);

\echo '=== 4. non-owner (stranger) -> ok=false not_owner ==='
do $$
declare v text;
begin
  select json_build_object('sub', (select stranger_id from _u))::text into v;
  perform set_config('request.jwt.claims', v, true);
end $$;
select * from public.review_idea_join_request(
  (select id from _req_a), '00000000-0000-0000-0000-0000a0400040', 'approve'
);

\echo '=== 5. idea-mismatch -> ok=false idea_mismatch ==='
do $$
declare v text;
begin
  select json_build_object('sub', (select owner_id from _u))::text into v;
  perform set_config('request.jwt.claims', v, true);
end $$;
select * from public.review_idea_join_request(
  (select id from _req_b), gen_random_uuid(), 'approve'
);

reset role;

rollback;
