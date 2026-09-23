begin;

create or replace function public.refresh_analytics_daily(since timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_daily (day, event_name, count, updated_at)
  select (src.created_at::date), src.event_name, count(*)::bigint, now()
  from public.analytics_events src
  where src.created_at >= since
  group by src.created_at::date, src.event_name
  on conflict (day, event_name) do update
    set count     = excluded.count,
        updated_at = now();
end;
$$;

revoke execute on function public.refresh_analytics_daily(timestamptz) from public, anon;
revoke execute on function public.refresh_analytics_daily(timestamptz) from authenticated;
grant execute on function public.refresh_analytics_daily(timestamptz) to service_role;

commit;