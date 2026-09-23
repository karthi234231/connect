begin;
insert into public.analytics_events (event_name, actor_id, entity_type, entity_id, created_at) values
('candidate_swiped','u1','profile','p1', now() at time zone 'utc'),
('candidate_swiped','u1','profile','p2', now() at time zone 'utc'),
('match_created','u1','profile','p3', now() at time zone 'utc');
select public.refresh_analytics_daily((now() at time zone 'utc')::date::timestamptz);
\echo ROUND1
select event_name, count from public.analytics_daily where day = (now() at time zone 'utc')::date order by event_name;
select public.refresh_analytics_daily((now() at time zone 'utc')::date::timestamptz);
\echo RERUN_IDEMPOTENT
select event_name, count from public.analytics_daily where day = (now() at time zone 'utc')::date order by event_name;
rollback;