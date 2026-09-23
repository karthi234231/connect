-- S02-TODO-B unit 3 probe: respond_connection_request atomic RPC.
\set ON_ERROR_STOP on
begin;

create temp table _probe as
select u1.id as requester_id, u2.id as addressee_id
from auth.users u1
join auth.users u2 on u2.id <> u1.id
limit 1;

insert into public.connection_requests (requester_id, addressee_id, status)
select requester_id, addressee_id, 'pending' from _probe;

\echo '--- scenario 1: accept as addressee should yield active match + timeline ---'
-- Emulate auth.uid() = addressee via set_config (reads request.jwt.claims).
do $$
declare
  v_claim text;
begin
  select json_build_object('sub', addressee_id)::text into v_claim from _probe;
  perform set_config('request.jwt.claims', v_claim, true);
end $$;
set local role postgres;

select * from public.respond_connection_request(
  (select id from public.connection_requests order by created_at desc limit 1),
  'accept'
);

\echo '--- verify: 1 active match, canonical user1<user2, 1 timeline row ---'
select id as match_id, user1_id, user2_id, status,
       user1_id < user2_id as canonical
from public.matches
where status = 'active';

select event_type, meta from public.match_timeline;

\echo '--- scenario 2: re-accept (not pending) should yield ok=false not_pending ---'
select * from public.respond_connection_request(
  (select id from public.connection_requests order by created_at desc limit 1),
  'accept'
);

reset role;

rollback;
