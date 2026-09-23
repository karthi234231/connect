-- S02 TODO-B unit 8 probe: settings upsert race-safe.
\set ON_ERROR_STOP on
begin;

create temp table _u as
select id from public.profiles p
where not exists (select 1 from public.notification_settings s where s.user_id = p.id)
order by p.id
limit 1;

\echo '=== 1. user without settings row exists ==='
select count(*) as candidates from _u;

\echo '=== 2. double upsert (simulates concurrent ensureSettings) -> one row, no error ==='
insert into public.notification_settings (user_id, quiet_hours_timezone, digest_cadence, digest_hour, digest_timezone, security_alerts)
select id as user_id, 'UTC', 'never', 9, 'UTC', true from _u
on conflict (user_id) do update set quiet_hours_timezone = excluded.quiet_hours_timezone;
insert into public.notification_settings (user_id, quiet_hours_timezone, digest_cadence, digest_hour, digest_timezone, security_alerts)
select id as user_id, 'UTC', 'never', 9, 'UTC', true from _u
on conflict (user_id) do update set quiet_hours_timezone = excluded.quiet_hours_timezone;
select count(*) as rows_for_user from public.notification_settings where user_id = (select id from _u);

\echo '=== 3. update-after-ensure works ==='
update public.notification_settings set digest_cadence = 'daily'
where user_id = (select id from _u)
returning digest_cadence;

rollback;
