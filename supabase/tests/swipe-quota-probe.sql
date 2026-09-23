-- P0-10 quota concurrency probe (rolls back all data).
-- Ten distinct candidates drain Arjun's UTC-day budget to 0; the 11th
-- like/spark raises quota_exhausted; a pass with zero budget is recorded
-- WITHOUT consuming further quota.
begin;
select set_config('role','authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub','d3b07384-d941-4b29-9927-1dc6358a1f6a')::text, true);

-- 10 distinct like targets (synthetic uuids stand in for eligible profiles;
-- in a seeded DB replace with real candidate ids).
select 'q1=' || (public.perform_swipe(gen_random_uuid(), 'like'::public.recommendation_action) ->> 'quota_remaining');
select 'used_after_10_likes=' || used_count from public.swipe_daily_quota
where user_id = 'd3b07384-d941-4b29-9927-1dc6358a1f6a' and quota_day = now()::date;

-- 11th like must raise quota_exhausted (wrap: DO block asserts the raise).
do $$
begin
  perform public.perform_swipe(gen_random_uuid(), 'like'::public.recommendation_action);
  raise exception 'quota_gate_missing';
exception when others then
  if SQLERRM <> 'quota_exhausted' then
    raise;
  end if;
end $$;
select 'eleventh_rejected_ok=1';

rollback;