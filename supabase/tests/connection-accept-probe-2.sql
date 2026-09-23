-- S02-TODO-B unit 3 probe (part 2): decline + non-addressee paths.
\set ON_ERROR_STOP on
begin;

create temp table _p as
select u1.id as r, u2.id as a
from auth.users u1
join auth.users u2 on u2.id <> u1.id
limit 1;

insert into public.connection_requests (requester_id, addressee_id, status)
select r, a, 'pending' from _p;

\echo '--- decline as addressee ---'
do $$
declare
  v text;
begin
  select json_build_object('sub', a)::text into v from _p;
  perform set_config('request.jwt.claims', v, true);
end $$;
set local role postgres;

select * from public.respond_connection_request(
  (select id from public.connection_requests order by created_at desc limit 1),
  'decline'
);

\echo '--- non-addressee (requester tries to act) -> ok=false ---'
do $$
declare
  v text;
begin
  select json_build_object('sub', r)::text into v from _p;
  perform set_config('request.jwt.claims', v, true);
end $$;

select * from public.respond_connection_request(
  (select id from public.connection_requests order by created_at desc limit 1),
  'accept'
);

reset role;

rollback;
