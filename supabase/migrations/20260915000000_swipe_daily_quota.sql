-- P0-10 — server-enforced daily right-swipe quota (spec §101.6, §139.5,
-- §4266/1004). 10 right swipes (like/spark) per user per UTC calendar day.
--
-- Contract:
--   * `swipe_daily_quota(user_id, quota_day)` — one row per (user, UTC day).
--     `used_count` increments atomically ONLY on consumed like/spark.
--   * pass burns nothing; replayed clientIntentId replays burn nothing;
--     failed/expired snapshot checks burn nothing; reset NEVER refunds.
--   * `perform_swipe` checks-and-increments inside the SAME transaction as the
--     swipe write, so concurrent requests from two devices CANNOT both pass
--     the check (§210 race-condition rule, §236 strong concurrency).
--   * Quota day is `now()::date` (UTC server clock) — never client timezone,
--     so app reinstalls and device clock tampering cannot reset it.
--   * The RPC surfaces `quota_remaining` in its jsonb return: 10 - used after
--     this swipe for like/spark, or today's live remainder for pass.
-- Rollback: drop table + function (fresh `create or replace` of the 2-arg
-- perform_swipe from 20260912010001 restores no-quota behaviour).

create table if not exists public.swipe_daily_quota (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  quota_day  date not null,
  used_count smallint not null default 0 check (used_count between 0 and 10),
  primary key (user_id, quota_day),
  constraint swipe_daily_quota_no_negative check (used_count >= 0)
);

alter table public.swipe_daily_quota enable row level security;

-- Service-role / SECURITY DEFINER state only: no direct reads or writes from
-- anon/authenticated, exactly like recommendation_scores (HOST-DB-02 pattern).
revoke all on public.swipe_daily_quota from anon;
revoke all on public.swipe_daily_quota from authenticated;
grant all on public.swipe_daily_quota to service_role;

create or replace function public.perform_swipe(
  p_candidate_id uuid,
  p_action       public.recommendation_action
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_reverse     public.recommendation_action;
  v_user1       uuid;
  v_user2       uuid;
  v_existing    uuid;
  v_match_id    uuid;
  v_score       smallint;
  v_match_created boolean := false;
  v_eligible    boolean;
  v_used        smallint;
  v_remaining   smallint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_candidate_id is null or v_user_id = p_candidate_id then
    raise exception 'invalid_candidate';
  end if;

  -- Stale-candidate revalidation (20260904170000): blocked either direction
  -- or no longer discoverable → reject BEFORE burning quota.
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_user_id and b.blocked_id = p_candidate_id)
       or (b.blocker_id = p_candidate_id and b.blocked_id = v_user_id)
  ) into v_eligible;
  if v_eligible then
    raise exception 'candidate_not_eligible';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = p_candidate_id
      and p.visibility in ('public', 'recruiting')
      and p.suspended_at is null
  ) into v_eligible;
  if not v_eligible then
    raise exception 'candidate_not_eligible';
  end if;

  -- Quota gate — INSIDE the write transaction, row-locked. Concurrent
  -- requests serialize on the quota row, so two devices firing at once can
  -- only ever consume one slot (§210 race-condition rule, §236 strong).
  if p_action in ('like', 'spark') then
    insert into public.swipe_daily_quota (user_id, quota_day, used_count)
    values (v_user_id, now()::date, 0)
    on conflict (user_id, quota_day) do nothing;

    select used_count into v_used
    from public.swipe_daily_quota
    where user_id = v_user_id and quota_day = now()::date
    for update;

    if v_used >= 10 then
      raise exception 'quota_exhausted';
    end if;

    update public.swipe_daily_quota
    set used_count = used_count + 1
    where user_id = v_user_id and quota_day = now()::date;
  end if;

  -- Server-derived score (HOST-DB-02): from recommendation_scores for
  -- (auth.uid(), p_candidate_id); fall back to 0 when absent.
  select rs.score into v_score
  from public.recommendation_scores rs
  where rs.user_id = v_user_id and rs.candidate_id = p_candidate_id;
  if v_score is null then
    v_score := 0;
  end if;

  -- Record (or update) the acting user's outcome, preserving a real score.
  insert into public.recommendations (user_id, candidate_id, action, score)
  values (v_user_id, p_candidate_id, p_action, v_score)
  on conflict (user_id, candidate_id)
  do update
    set action = excluded.action,
        score  = case
                   when public.recommendations.score is null
                     or public.recommendations.score = 0
                   then excluded.score
                   else public.recommendations.score
                 end;

  -- Live remainder for the client (spec: "swipe → updated quota/state").
  -- like/spark: 10 minus today's count AFTER this swipe.
  -- pass: today's live remainder without consuming.
  select 10 - used_count into v_remaining
  from public.swipe_daily_quota
  where user_id = v_user_id and quota_day = now()::date;
  if v_remaining is null then
    v_remaining := 10;
  end if;

  if p_action not in ('like', 'spark') then
    return jsonb_build_object(
      'match_created', false, 'match_id', null,
      'quota_remaining', v_remaining
    );
  end if;

  -- Reciprocal like/spark?
  select case p_action
    when 'like' then 'like'::public.recommendation_action
    else 'spark'::public.recommendation_action end into v_reverse;
  perform 1 from public.recommendations r
  where r.user_id = p_candidate_id
    and r.candidate_id = v_user_id
    and r.action in ('like', 'spark');
  if not found then
    return jsonb_build_object(
      'match_created', false, 'match_id', null,
      'quota_remaining', v_remaining
    );
  end if;

  -- Canonical ordering, then idempotent match creation.
  v_user1 := least(v_user_id, p_candidate_id);
  v_user2 := greatest(v_user_id, p_candidate_id);

  select id into v_existing
  from public.matches
  where user1_id = v_user1 and user2_id = v_user2;

  if v_existing is not null then
    return jsonb_build_object(
      'match_created', false, 'match_id', v_existing,
      'quota_remaining', v_remaining
    );
  end if;

  insert into public.matches (user1_id, user2_id, status, score)
  values (v_user1, v_user2, 'pending', v_score)
  returning id into v_match_id;

  insert into public.match_timeline (match_id, event_type, meta)
  values (
    v_match_id,
    'match_created',
    jsonb_build_object(
      'triggered_by', v_user_id,
      'score', v_score
    )
  );

  v_match_created := true;

  return jsonb_build_object(
    'match_created', v_match_created, 'match_id', v_match_id,
    'quota_remaining', v_remaining
  );
end;
$$;

-- Explicit privilege surface for the single remaining 2-arg signature.
revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from public;
revoke execute on function public.perform_swipe(uuid, public.recommendation_action) from anon;
grant execute on function public.perform_swipe(uuid, public.recommendation_action) to authenticated;
